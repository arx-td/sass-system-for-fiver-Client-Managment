import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  // Create Admin user
  const adminPassword = await bcrypt.hash('Admin@123456', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@codereve.com' },
    update: {},
    create: {
      email: 'admin@codereve.com',
      passwordHash: adminPassword,
      name: 'System Admin',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });
  console.log('✅ Admin user created:', admin.email);

  // Create Manager user
  const managerPassword = await bcrypt.hash('Manager@123456', 10);
  const manager = await prisma.user.upsert({
    where: { email: 'manager@codereve.com' },
    update: {},
    create: {
      email: 'manager@codereve.com',
      passwordHash: managerPassword,
      name: 'Project Manager',
      role: UserRole.MANAGER,
      status: UserStatus.ACTIVE,
      invitedById: admin.id,
    },
  });
  console.log('✅ Manager user created:', manager.email);

  // Create Team Lead user
  const teamLeadPassword = await bcrypt.hash('TeamLead@123456', 10);
  const teamLead = await prisma.user.upsert({
    where: { email: 'teamlead@codereve.com' },
    update: {},
    create: {
      email: 'teamlead@codereve.com',
      passwordHash: teamLeadPassword,
      name: 'Team Lead',
      role: UserRole.TEAM_LEAD,
      status: UserStatus.ACTIVE,
      invitedById: admin.id,
    },
  });
  console.log('✅ Team Lead user created:', teamLead.email);

  // Create Developer users
  const developerPassword = await bcrypt.hash('Developer@123456', 10);
  const developer1 = await prisma.user.upsert({
    where: { email: 'developer1@codereve.com' },
    update: {},
    create: {
      email: 'developer1@codereve.com',
      passwordHash: developerPassword,
      name: 'John Developer',
      role: UserRole.DEVELOPER,
      status: UserStatus.ACTIVE,
      invitedById: admin.id,
    },
  });
  console.log('✅ Developer 1 created:', developer1.email);

  const developer2 = await prisma.user.upsert({
    where: { email: 'developer2@codereve.com' },
    update: {},
    create: {
      email: 'developer2@codereve.com',
      passwordHash: developerPassword,
      name: 'Jane Developer',
      role: UserRole.DEVELOPER,
      status: UserStatus.ACTIVE,
      invitedById: admin.id,
    },
  });
  console.log('✅ Developer 2 created:', developer2.email);

  // Create Designer user
  const designerPassword = await bcrypt.hash('Designer@123456', 10);
  const designer = await prisma.user.upsert({
    where: { email: 'designer@codereve.com' },
    update: {},
    create: {
      email: 'designer@codereve.com',
      passwordHash: designerPassword,
      name: 'Creative Designer',
      role: UserRole.DESIGNER,
      status: UserStatus.ACTIVE,
      invitedById: admin.id,
    },
  });
  console.log('✅ Designer user created:', designer.email);

  // Create Fiverr Accounts
  const fiverrAccount1 = await prisma.fiverrAccount.upsert({
    where: { accountName: 'CodeReve_Main' },
    update: {},
    create: {
      accountName: 'CodeReve_Main',
      accountEmail: 'main@codereve.com',
      isActive: true,
      createdById: admin.id,
    },
  });
  console.log('✅ Fiverr Account 1 created:', fiverrAccount1.accountName);

  const fiverrAccount2 = await prisma.fiverrAccount.upsert({
    where: { accountName: 'CodeReve_Pro' },
    update: {},
    create: {
      accountName: 'CodeReve_Pro',
      accountEmail: 'pro@codereve.com',
      isActive: true,
      createdById: admin.id,
    },
  });
  console.log('✅ Fiverr Account 2 created:', fiverrAccount2.accountName);

  // Create sample system settings
  await prisma.systemSetting.upsert({
    where: { key: 'smtp_config' },
    update: {},
    create: {
      key: 'smtp_config',
      value: {
        host: 'smtp.mailtrap.io',
        port: 2525,
        secure: false,
        auth: {
          user: '',
          pass: '',
        },
        from: 'noreply@codereve.com',
      },
      category: 'SMTP',
    },
  });
  console.log('✅ SMTP settings created');

  await prisma.systemSetting.upsert({
    where: { key: 'n8n_config' },
    update: {},
    create: {
      key: 'n8n_config',
      value: {
        enabled: false,
        webhookUrl: '',
        apiKey: '',
      },
      category: 'N8N',
    },
  });
  console.log('✅ n8n settings created');

  await prisma.systemSetting.upsert({
    where: { key: 'general_config' },
    update: {},
    create: {
      key: 'general_config',
      value: {
        companyName: 'CodeReve',
        timezone: 'UTC',
        dateFormat: 'YYYY-MM-DD',
        notificationsEnabled: true,
      },
      category: 'GENERAL',
    },
  });
  console.log('✅ General settings created');

  console.log('\n✨ Database seeding completed!\n');
  console.log('📋 Test Credentials:');
  console.log('─────────────────────────────────────────');
  console.log('Admin:     admin@codereve.com     / Admin@123456');
  console.log('Manager:   manager@codereve.com   / Manager@123456');
  console.log('Team Lead: teamlead@codereve.com  / TeamLead@123456');
  console.log('Developer: developer1@codereve.com / Developer@123456');
  console.log('Developer: developer2@codereve.com / Developer@123456');
  console.log('Designer:  designer@codereve.com  / Designer@123456');
  console.log('─────────────────────────────────────────\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
