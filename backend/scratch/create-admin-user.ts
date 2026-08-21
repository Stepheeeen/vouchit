import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@usevouchit.com';
  const password = 'adminpassword123';
  
  try {
    // Check if user already exists
    let user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      console.log('Admin user already exists, resetting...');
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
        displayName: 'System Admin',
        role: 'ADMIN',
      },
      
    });
    
    console.log('Created Admin Account:');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log(`Role: ${newUser.role}`);
  } catch (error) {
    console.error('Failed to create admin account:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
