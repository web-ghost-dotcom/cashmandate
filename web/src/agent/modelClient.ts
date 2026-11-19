export interface ModelSettings {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;
}

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  baseUrl: 'https://api.vultrinference.com/v1',
  apiKey: '',
  model: 'deepseek-v4.1-flash-1017',
};

export interface AgentTool {
  readonly name: string;
  readonly description: string;
  readonly parameters: Readonly<Record<string, unknown>>;
  execute(toolArguments: Record<string, unknown>): Promise<unknown>;
}

export type AgentEvent =
  | { readonly kind: 'task'; readonly text: string }
  | { readonly kind: 'agent-says'; readonly text: string }
  | { readonly kind: 'tool-call'; readonly toolName: string; readonly text: string }
  | { readonly kind: 'tool-result'; readonly toolName: string; readonly text: string };

interface ChatToolCall {
  readonly id: string;
  readonly type: 'function';
  readonly function: { readonly name: string; readonly arguments: string };
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ChatToolCall[];
  tool_call_id?: string;
}

export interface ToolLoopRequest {
  readonly settings: ModelSettings;
  readonly systemPrompt: string;
  readonly task: string;
  readonly tools: readonly AgentTool[];
  readonly onEvent: (event: AgentEvent) => void;
  readonly signal: AbortSignal;
}

const MAXIMUM_AGENT_STEPS = 10;

export class ModelRequestError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ModelRequestError';
  }
}

function describeTools(tools: readonly AgentTool[]): unknown[] {
  return tools.map(function toChatTool(tool) {
    return { type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.parameters } };
  });
}

async function requestCompletion(request: ToolLoopRequest, messages: ChatMessage[]): Promise<ChatMessage> {
  const { settings } = request;
  let response: Response;
  try {
    response = await fetch(`${settings.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      signal: request.signal,
      headers: { Authorization: `Bearer ${settings.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: settings.model, messages, tools: describeTools(request.tools), temperature: 0 }),
    });
  } catch (failure) {
    if (request.signal.aborted) throw failure;
    throw new ModelRequestError(`Could not reach ${settings.baseUrl}. Check the address and your connection.`);
  }
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 200);
    throw new ModelRequestError(`The model provider answered ${response.status}. ${detail}`);
  }
  const body = (await response.json()) as { choices?: { message?: ChatMessage }[] };
  const message = body.choices?.[0]?.message;
  if (message === undefined) {
    throw new ModelRequestError('The model provider returned no message.');
  }
  return message;
}

function parseToolArguments(rawArguments: string): Record<string, unknown> {
  if (rawArguments.trim() === '') return {};
  const parsed: unknown = JSON.parse(rawArguments);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ModelRequestError('The model sent tool arguments that are not an object.');
  }
  return parsed as Record<string, unknown>;
}

async function executeToolCall(request: ToolLoopRequest, toolCall: ChatToolCall): Promise<string> {
  const tool = request.tools.find(function matchesName(candidate) {
    return candidate.name === toolCall.function.name;
  });
  request.onEvent({ kind: 'tool-call', toolName: toolCall.function.name, text: toolCall.function.arguments });
  let resultText: string;
  if (tool === undefined) {
    resultText = JSON.stringify({ error: `No tool named ${toolCall.function.name}` });
  } else {
    try {
      resultText = JSON.stringify(await tool.execute(parseToolArguments(toolCall.function.arguments)));
    } catch (failure) {
      resultText = JSON.stringify({ error: failure instanceof Error ? failure.message : String(failure) });
    }
  }
  request.onEvent({ kind: 'tool-result', toolName: toolCall.function.name, text: resultText });
  return resultText;
}

/** Runs one agent: the model reads the task, calls tools, and stops when it answers without a tool call. */
export async function runToolLoop(request: ToolLoopRequest): Promise<void> {
  const messages: ChatMessage[] = [
    { role: 'system', content: request.systemPrompt },
    { role: 'user', content: request.task },
  ];
  request.onEvent({ kind: 'task', text: request.task });
  for (let step = 0; step < MAXIMUM_AGENT_STEPS; step += 1) {
    const reply = await requestCompletion(request, messages);
    messages.push(reply);
    if (reply.content) request.onEvent({ kind: 'agent-says', text: reply.content.trim() });
    const toolCalls = reply.tool_calls ?? [];
    if (toolCalls.length === 0) return;
    for (const toolCall of toolCalls) {
      const resultText = await executeToolCall(request, toolCall);
      messages.push({ role: 'tool', tool_call_id: toolCall.id, content: resultText });
    }
  }
}
