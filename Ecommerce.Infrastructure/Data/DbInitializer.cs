using System;
using System.Linq;
using System.Threading.Tasks;
using Ecommerce.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;

namespace Ecommerce.Infrastructure.Data;

public static class DbInitializer
{
    public static async Task SeedAsync(
        ApplicationDbContext context,
        UserManager<AppUser> userManager,
        RoleManager<IdentityRole> roleManager)
    {
        // Seed Categories
        if (!await context.Categories.AnyAsync())
        {
            var categories = new[]
            {
                new Category { Name = "Electronics", Description = "Gadgets and devices" },
                new Category { Name = "Clothing", Description = "Apparel and fashion accessories" },
                new Category { Name = "Home & Kitchen", Description = "Appliances and decor" }
            };
            await context.Categories.AddRangeAsync(categories);
            await context.SaveChangesAsync();
        }

        // Seed Brands
        if (!await context.Brands.AnyAsync())
        {
            var brands = new[]
            {
                new Brand { Name = "Apple", Description = "Think Different" },
                new Brand { Name = "Samsung", Description = "Inspire the World" },
                new Brand { Name = "Nike", Description = "Just Do It" }
            };
            await context.Brands.AddRangeAsync(brands);
            await context.SaveChangesAsync();
        }

        // Seed Products
        if (!await context.Products.AnyAsync())
        {
            var electronics = await context.Categories.FirstAsync(c => c.Name == "Electronics");
            var clothing = await context.Categories.FirstAsync(c => c.Name == "Clothing");
            
            var apple = await context.Brands.FirstAsync(b => b.Name == "Apple");
            var samsung = await context.Brands.FirstAsync(b => b.Name == "Samsung");
            var nike = await context.Brands.FirstAsync(b => b.Name == "Nike");

            var products = new[]
            {
                new Product
                {
                    Name = "iPhone 15 Pro",
                    Description = "Titanium body, A17 Pro chip, action button.",
                    Price = 999.99m,
                    ImageUrl = "iphone15pro.jpg",
                    StockQuantity = 10,
                    CategoryId = electronics.Id,
                    BrandId = apple.Id
                },
                new Product
                {
                    Name = "Galaxy S24 Ultra",
                    Description = "Galaxy AI, 200MP camera, built-in S-Pen.",
                    Price = 1199.99m,
                    ImageUrl = "s24ultra.jpg",
                    StockQuantity = 15,
                    CategoryId = electronics.Id,
                    BrandId = samsung.Id
                },
                new Product
                {
                    Name = "Nike Air Max 270",
                    Description = "Comfortable everyday athletic shoes.",
                    Price = 150.00m,
                    ImageUrl = "airmax270.jpg",
                    StockQuantity = 50,
                    CategoryId = clothing.Id,
                    BrandId = nike.Id
                }
            };
            await context.Products.AddRangeAsync(products);
            await context.SaveChangesAsync();
        }

        // Seed Roles
        if (!await roleManager.RoleExistsAsync("Admin"))
        {
            await roleManager.CreateAsync(new IdentityRole("Admin"));
        }
        if (!await roleManager.RoleExistsAsync("Customer"))
        {
            await roleManager.CreateAsync(new IdentityRole("Customer"));
        }

        // Seed Admin User
        var adminEmail = "admin@ecommerce.com";
        if (await userManager.FindByEmailAsync(adminEmail) == null)
        {
            var adminUser = new AppUser
            {
                UserName = adminEmail,
                Email = adminEmail,
                FirstName = "Admin",
                LastName = "User",
                Address = "Main Street",
                City = "Dhaka",
                EmailConfirmed = true
            };
            var result = await userManager.CreateAsync(adminUser, "Admin123!");
            if (result.Succeeded)
            {
                await userManager.AddToRoleAsync(adminUser, "Admin");
            }
        }

        // Seed Customer User
        var customerEmail = "customer@ecommerce.com";
        if (await userManager.FindByEmailAsync(customerEmail) == null)
        {
            var customerUser = new AppUser
            {
                UserName = customerEmail,
                Email = customerEmail,
                FirstName = "John",
                LastName = "Doe",
                Address = "Mirpur Road",
                City = "Dhaka",
                EmailConfirmed = true
            };
            var result = await userManager.CreateAsync(customerUser, "Customer123!");
            if (result.Succeeded)
            {
                await userManager.AddToRoleAsync(customerUser, "Customer");
            }
        }
    }
}
