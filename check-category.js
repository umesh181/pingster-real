const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCategory() {
  try {
    const apiKey = 'cm75487ro0001sp0wkg0wnxk0'; // The API key from the user's request
    const categoryName = 'sale'; // The category from the user's request
    
    const user = await prisma.user.findUnique({
      where: { apiKey },
      include: { EventCategories: true },
    });
    
    if (!user) {
      console.log('User not found for the provided API key');
      return;
    }
    
    // Check if the category exists
    const category = user.EventCategories.find(cat => cat.name === categoryName);
    
    if (!category) {
      console.log(`Category '${categoryName}' was not found for this user.`);
      console.log('Available categories:');
      user.EventCategories.forEach(cat => {
        console.log(`- ${cat.name}`);
      });
      
      console.log('\nLet\'s create this category for the user...');
      // Create the category
      const newCategory = await prisma.eventCategory.create({
        data: {
          name: categoryName,
          color: 0x007bff, // Default blue color
          emoji: '💰',    // Sale emoji
          userId: user.id
        }
      });
      
      console.log(`Category created: ${newCategory.name} with ID: ${newCategory.id}`);
    } else {
      console.log(`Category found: ${category.name} with ID: ${category.id}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCategory(); 