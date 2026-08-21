import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config({ path: "../backend/.env" });

const DEPLOYER_PRIVATE_KEY = process.env.ADMIN_RELAYER_PRIVATE_KEY;
const accounts = DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "paris",
    },
  },
  paths: {
    sources: "./src",
    tests: "./test",
  },
  networks: {
    // Local chain for end-to-end runs: `npx hardhat node` in one shell, then
    // `npm run e2e`. No faucet, no keys, no external dependency.
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 31337,
    },
    baseSepolia: {
      url: process.env.WEB3_RPC_URL || "https://sepolia.base.org",
      chainId: 84532,
      accounts,
    },
    base: {
      url: process.env.WEB3_RPC_URL_MAINNET || "https://mainnet.base.org",
      chainId: 8453,
      accounts,
    },
  },
  etherscan: {
    apiKey: { baseSepolia: process.env.BASESCAN_API_KEY || "", base: process.env.BASESCAN_API_KEY || "" },
  },
};

export default config;
