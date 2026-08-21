import { ethers, network } from "hardhat";

async function main() {
  const treasury = process.env.TREASURY_ADDRESS;
  if (!treasury || !ethers.isAddress(treasury)) {
    throw new Error(
      "TREASURY_ADDRESS must be set to a valid address in backend/.env before deploying.",
    );
  }

  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("No deployer account. Set ADMIN_RELAYER_PRIVATE_KEY in backend/.env.");
  }

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Network:  ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(balance)} ETH`);
  console.log(`Treasury: ${treasury}`);

  if (balance === 0n) {
    throw new Error("Deployer has zero balance — fund it before deploying.");
  }

  const factory = await ethers.getContractFactory("VouchitEscrow");
  const escrow = await factory.deploy(treasury);
  await escrow.waitForDeployment();

  const address = await escrow.getAddress();
  console.log(`\nVouchitEscrow deployed at: ${address}`);
  console.log(`\nSet in backend/.env and Render:`);
  console.log(`VOUCHIT_ESCROW_CONTRACT_ADDRESS=${address}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
