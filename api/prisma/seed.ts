import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  const email = 'gdinov@gmail.com'
  const password = 'TestPass321'
  const passwordHash = await bcrypt.hash(password, 12)

  // Upsert a default tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'canopy-default' },
    update: {},
    create: {
      name: 'Canopy Default',
      slug: 'canopy-default',
      settings: {},
    },
  })
  console.log(`Tenant: ${tenant.name} (id: ${tenant.id})`)

  // Create the admin user if not exists
  const existing = await prisma.user.findFirst({
    where: { email, tenantId: tenant.id },
  })

  if (existing) {
    console.log(`User ${email} already exists (id: ${existing.id})`)
  } else {
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email,
        passwordHash,
        firstName: 'Goran',
        lastName: 'Dinov',
        role: 'owner',
        isActive: true,
      },
    })
    console.log(`Created owner user: ${user.email} (id: ${user.id})`)
  }

  console.log('Seeding complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
