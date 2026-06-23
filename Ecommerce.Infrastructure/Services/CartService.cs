using System;
using System.Linq;
using System.Threading.Tasks;
using Ecommerce.Application.DTOs;
using Ecommerce.Application.Interfaces;
using Ecommerce.Application.Extensions;
using Ecommerce.Domain.Entities;
using Ecommerce.Domain.Exceptions;
using Ecommerce.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Ecommerce.Infrastructure.Services;

public class CartService : ICartService
{
    private readonly ApplicationDbContext _context;

    public CartService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<CartDto> GetCartByUserIdAsync(string userId)
    {
        var cart = await GetOrCreateCartAsync(userId);
        return cart.ToDto();
    }

    public async Task<CartDto> AddOrUpdateItemAsync(string userId, CartItemUpdateDto dto)
    {
        var cart = await GetOrCreateCartAsync(userId);
        
        var product = await _context.Products.FindAsync(dto.ProductId);
        if (product == null)
        {
            throw new NotFoundException($"Product with ID {dto.ProductId} not found.");
        }

        if (dto.Quantity <= 0)
        {
            return await RemoveItemAsync(userId, dto.ProductId);
        }

        if (product.StockQuantity < dto.Quantity)
        {
            throw new Exception($"Cannot add product. Only {product.StockQuantity} items in stock.");
        }

        var existingItem = cart.Items.FirstOrDefault(i => i.ProductId == dto.ProductId);
        if (existingItem != null)
        {
            existingItem.Quantity = dto.Quantity;
            existingItem.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            var cartItem = new CartItem
            {
                CartId = cart.Id,
                ProductId = dto.ProductId,
                Quantity = dto.Quantity
            };
            cart.Items.Add(cartItem);
        }

        await _context.SaveChangesAsync();
        
        var updatedCart = await GetOrCreateCartAsync(userId);
        return updatedCart.ToDto();
    }

    public async Task<CartDto> RemoveItemAsync(string userId, int productId)
    {
        var cart = await GetOrCreateCartAsync(userId);
        var item = cart.Items.FirstOrDefault(i => i.ProductId == productId);
        
        if (item != null)
        {
            _context.CartItems.Remove(item);
            await _context.SaveChangesAsync();
        }

        var updatedCart = await GetOrCreateCartAsync(userId);
        return updatedCart.ToDto();
    }

    public async Task ClearCartAsync(string userId)
    {
        var cart = await GetOrCreateCartAsync(userId);
        if (cart.Items.Any())
        {
            _context.CartItems.RemoveRange(cart.Items);
            await _context.SaveChangesAsync();
        }
    }

    private async Task<Cart> GetOrCreateCartAsync(string userId)
    {
        var cart = await _context.Carts
            .Include(c => c.Items)
                .ThenInclude(i => i.Product)
            .FirstOrDefaultAsync(c => c.UserId == userId);

        if (cart == null)
        {
            cart = new Cart { UserId = userId };
            _context.Carts.Add(cart);
            await _context.SaveChangesAsync();
            
            cart = await _context.Carts
                .Include(c => c.Items)
                    .ThenInclude(i => i.Product)
                .FirstAsync(c => c.Id == cart.Id);
        }

        return cart;
    }
}
