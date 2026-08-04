const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const prisma = new PrismaClient();

async function createAdmin() {
  const email = process.argv[2] || 'admin@example.com';
  const password = process.argv[3] || 'admin123';
  const firstName = process.argv[4] || 'Admin';
  const lastName = process.argv[5] || 'User';

  try {
    // Check if admin already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // Update to admin if not already
      if (existingUser.role !== 'SUPER_ADMIN') {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { role: 'SUPER_ADMIN' },
        });
        console.log(`✅ User ${email} updated to SUPER_ADMIN`);
      } else {
        console.log(`ℹ️  User ${email} is already a SUPER_ADMIN`);
      }
      
      // Update password
      const hashedPassword = await bcrypt.hash(password, 10);
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { password: hashedPassword },
      });
      console.log(`✅ Password updated for ${email}`);
      return;
    }

    // Create new admin user
    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: 'SUPER_ADMIN',
        isActive: true,
      },
    });

    console.log('✅ Admin user created successfully!');
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('👤 Name:', `${firstName} ${lastName}`);
    console.log('🔐 Role: SUPER_ADMIN');
    console.log('\n⚠️  Please change the password after first login!');
  } catch (error) {
    console.error('❌ Error creating admin:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();

