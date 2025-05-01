const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkApiKey() {
  try {
    const apiKey = 'cm75487ro0001sp0wkg0wnxk0'; // The API key from the user's request
    
    const user = await prisma.user.findUnique({
      where: { apiKey },
      include: { EventCategories: true },
    });
    
    if (!user) {
      console.log('User not found for the provided API key');
      return;
    }
    
    console.log('User found:', {
      id: user.id,
      email: user.email,
      discordId: user.discordId,
      plan: user.plan,
    });
    
    console.log('Event Categories:');
    user.EventCategories.forEach(category => {
      console.log(`- ${category.name} (ID: ${category.id})`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkApiKey(); 