import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { verifyMessage } from 'ethers';

@Injectable()
export class Web3Service {
  constructor(private prisma: PrismaService) {}

  /**
   * Verify an EVM signature for a given message
   */
  verifySignature(address: string, signature: string, message: string): boolean {
    try {
      const recoveredAddress = verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === address.toLowerCase();
    } catch (error) {
      console.error('[Web3Service] Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Link an EVM wallet address to a user account
   */
  async linkWallet(userId: string, address: string, signature: string) {
    if (!address || !signature) {
      throw new BadRequestException('Address and signature are required');
    }

    const expectedMessage = `Sign to verify ownership of wallet ${address} for Vouchit account ${userId}`;
    const isValid = this.verifySignature(address, signature, expectedMessage);

    if (!isValid) {
      throw new BadRequestException('Invalid signature');
    }

    const normalizedAddress = address.toLowerCase();

    // Check if address is already linked to another account
    const existing = await this.prisma.user.findUnique({
      where: { web3Address: normalizedAddress },
    });
    if (existing && existing.id !== userId) {
      throw new BadRequestException('This wallet address is already linked to another account');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { web3Address: normalizedAddress },
      include: { wallet: true },
    });

    return { message: 'Wallet linked successfully', user };
  }

  /**
   * Unlink EVM wallet
   */
  async unlinkWallet(userId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { web3Address: null },
    });
    return { message: 'Wallet unlinked successfully', user };
  }

  /**
   * Trigger on-chain dispute resolution via Admin Relayer
   * If WEB3_RPC_URL or ADMIN_PRIVATE_KEY is missing, logs mock relayer event
   */
  async resolveOnChainDispute(
    wagerId: string,
    contractWagerId: string,
    winnerAddress: string,
    resolutionType: 1 | 2,
  ) {
    const contractAddress = process.env.VOUCHIT_ESCROW_CONTRACT_ADDRESS;
    const rpcUrl = process.env.WEB3_RPC_URL;
    const adminPrivateKey = process.env.ADMIN_RELAYER_PRIVATE_KEY;

    if (!contractAddress || !rpcUrl || !adminPrivateKey) {
      console.log(`[Web3Service Mock Relayer] On-chain dispute resolved for wager ${wagerId} (Contract ID: ${contractWagerId}): Winner=${winnerAddress}, Type=${resolutionType}`);
      return {
        success: true,
        txHash: `0xmock_tx_${Date.now()}`,
        message: 'On-chain dispute resolved (Mock Relayer Mode)',
      };
    }

    try {
      const { JsonRpcProvider, Wallet, Contract } = await import('ethers');
      const provider = new JsonRpcProvider(rpcUrl);
      const relayerWallet = new Wallet(adminPrivateKey, provider);

      const abi = [
        'function resolveDispute(bytes32 wagerId, address winner, uint8 resolutionType) external',
      ];
      const escrowContract = new Contract(contractAddress, abi, relayerWallet);

      const tx = await escrowContract.resolveDispute(contractWagerId, winnerAddress, resolutionType);
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.hash,
        message: 'On-chain dispute resolved successfully',
      };
    } catch (error: any) {
      console.error('[Web3Service] Failed to resolve on-chain dispute:', error);
      throw new BadRequestException(error.message || 'Failed to trigger on-chain dispute resolution');
    }
  }
}
