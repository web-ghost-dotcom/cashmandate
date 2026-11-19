import { z } from 'zod';
import { createAgentIdentityFromHex, exportPrivateKeyHex, generateAgentIdentity, type AgentIdentity, type SupportedNetwork } from './identity';

export const AGENT_ROLES = ['owner', 'agent', 'merchantOne', 'merchantTwo', 'stranger'] as const;
export type AgentRole = (typeof AGENT_ROLES)[number];

export type AgentRoster = Readonly<Record<AgentRole, AgentIdentity>>;

const rosterFileSchema = z.object({
  network: z.string(),
  privateKeysHex: z.object({
    owner: z.string(),
    agent: z.string(),
    merchantOne: z.string(),
    merchantTwo: z.string(),
    stranger: z.string(),
  }),
});

export type RosterFile = z.infer<typeof rosterFileSchema>;

export function generateRosterFile(network: SupportedNetwork): RosterFile {
  const privateKeysHex: Record<string, string> = {};
  for (const role of AGENT_ROLES) {
    privateKeysHex[role] = exportPrivateKeyHex(generateAgentIdentity(role, network));
  }
  return { network, privateKeysHex } as RosterFile;
}

export function parseRosterFile(rosterFileContents: string, network: SupportedNetwork): AgentRoster {
  const parsedRosterFile = rosterFileSchema.parse(JSON.parse(rosterFileContents));
  if (parsedRosterFile.network !== network) {
    throw new Error(
      `Roster was created for ${parsedRosterFile.network} but ${network} was requested`,
    );
  }
  const identitiesByRole: Partial<Record<AgentRole, AgentIdentity>> = {};
  for (const role of AGENT_ROLES) {
    identitiesByRole[role] = createAgentIdentityFromHex(
      role,
      parsedRosterFile.privateKeysHex[role],
      network,
    );
  }
  return identitiesByRole as AgentRoster;
}
