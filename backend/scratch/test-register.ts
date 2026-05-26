import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Resend } from 'resend';

const prisma = new PrismaClient();
const resend = new Resend(process.env.RESEND_API_KEY || 're_mock_key');

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function testRegister(email: string, passwordHash: string) {
  console.log(`Registering ${email}...`);
  try {
    const otp = generateOtp();
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const hashedPassword = await bcrypt.hash(passwordHash, 10);
    
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        otp,
        otpExpiresAt,
        wallet: {
          create: {
            availableBalance: 0,
            escrowBalance: 0,
            lockedBalance: 0,
          },
        },
      },
      include: { wallet: true },
    });
    console.log('User created successfully:', user);
    
    // Clean up
    await prisma.user.delete({ where: { id: user.id } });
    console.log('User deleted (cleaned up).');
  } catch (error) {
    console.error('Registration failed with error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testRegister('test-reg-unique@flairtechlabs.co', 'password123');
