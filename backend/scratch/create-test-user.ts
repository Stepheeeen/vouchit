import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'paystack-reviewer@usevouchit.com';
  const password = 'password123';
  
  try {
    // Check if user already exists
    let user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      console.log('Test user already exists, resetting...');
      if (user.id) {
        await prisma.user.delete({ where: { id: user.id } });
      }
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        emailVerified: true,
        displayName: 'Paystack Reviewer',
      },
      
    });
    
    console.log('Created Paystack Reviewer Account:');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
  } catch (error) {
    console.error('Failed to create reviewer account:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
