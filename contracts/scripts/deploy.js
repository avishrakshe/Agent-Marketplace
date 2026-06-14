const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "tAGT");

  const TestUSDC = await hre.ethers.getContractFactory("TestUSDC");
  const testUSDC = await TestUSDC.deploy();
  await testUSDC.waitForDeployment();
  const testUSDCAddress = await testUSDC.getAddress();
  console.log("TestUSDC deployed to:", testUSDCAddress);

  const IdentityRegistry = await hre.ethers.getContractFactory("IdentityRegistry");
  const identityRegistry = await IdentityRegistry.deploy();
  await identityRegistry.waitForDeployment();
  const identityRegistryAddress = await identityRegistry.getAddress();
  console.log("IdentityRegistry deployed to:", identityRegistryAddress);

  const PaymentSettlement = await hre.ethers.getContractFactory("PaymentSettlement");
  const paymentSettlement = await PaymentSettlement.deploy(testUSDCAddress);
  await paymentSettlement.waitForDeployment();
  const paymentSettlementAddress = await paymentSettlement.getAddress();
  console.log("PaymentSettlement deployed to:", paymentSettlementAddress);

  const ReputationRegistry = await hre.ethers.getContractFactory("ReputationRegistry");
  const reputationRegistry = await ReputationRegistry.deploy(paymentSettlementAddress);
  await reputationRegistry.waitForDeployment();
  const reputationRegistryAddress = await reputationRegistry.getAddress();
  console.log("ReputationRegistry deployed to:", reputationRegistryAddress);

  const StakeManager = await hre.ethers.getContractFactory("StakeManager");
  const stakeManager = await StakeManager.deploy(testUSDCAddress, deployer.address);
  await stakeManager.waitForDeployment();
  const stakeManagerAddress = await stakeManager.getAddress();
  console.log("StakeManager deployed to:", stakeManagerAddress);

  const network = await hre.ethers.provider.getNetwork();
  const artifactNames = ["TestUSDC", "IdentityRegistry", "PaymentSettlement", "ReputationRegistry", "StakeManager"];
  const abis = {};
  for (const name of artifactNames) {
    const artifact = await hre.artifacts.readArtifact(name);
    abis[name] = artifact.abi;
  }

  const deployed = {
    chainId: Number(network.chainId),
    rpcUrl: process.env.RPC_URL,
    deployer: deployer.address,
    contracts: {
      TestUSDC: testUSDCAddress,
      IdentityRegistry: identityRegistryAddress,
      PaymentSettlement: paymentSettlementAddress,
      ReputationRegistry: reputationRegistryAddress,
      StakeManager: stakeManagerAddress,
    },
    abis,
    deployedAt: new Date().toISOString(),
  };

  const sharedDir = path.join(__dirname, "..", "..", "shared");
  fs.mkdirSync(sharedDir, { recursive: true });
  const outPath = path.join(sharedDir, "deployed.json");
  fs.writeFileSync(outPath, JSON.stringify(deployed, null, 2));
  console.log("Wrote deployment info to:", outPath);

  // Verify code exists onchain
  for (const [name, address] of Object.entries(deployed.contracts)) {
    const code = await hre.ethers.provider.getCode(address);
    if (code === "0x") {
      throw new Error(`No bytecode at ${name} address ${address}`);
    }
    console.log(`Verified ${name} bytecode at ${address}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
