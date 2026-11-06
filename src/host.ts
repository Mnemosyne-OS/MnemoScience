/**
 * host.ts — MnemoScience's one SDK client, shared by App and the agent actions (doc 149).
 * One copy, so the window and the agent door speak to the host as the same cartridge.
 */
import { MnemoCartridgeSDK } from './sdk/mnemo-sdk';

// Must match "name" in mnemo-plugin.json: the host keys the Memory Packs on it.
export const sdk = new MnemoCartridgeSDK('@mnemosyne-plugins/mnemo-science');
