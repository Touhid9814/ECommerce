using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Ecommerce.Application.DTOs;
using Ecommerce.Application.Interfaces;
using Ecommerce.Application.Extensions;
using Ecommerce.Domain.Entities;
using Ecommerce.Domain.Enums;
using Ecommerce.Domain.Exceptions;
using Ecommerce.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Ecommerce.Infrastructure.Services;

public class OrderService : IOrderService
{
    private readonly ApplicationDbContext _context;
    private readonly ICartService _cartService;

    public OrderService(ApplicationDbContext context, ICartService cartService)
    {
        _context = context;
        _cartService = cartService;
    }

    public async Task<OrderDto> CreateOrderAsync(string userId, OrderCreateDto dto)
    {
        var cart = await _context.Carts
            .Include(c => c.Items)
                .ThenInclude(i => i.Product)
            .FirstOrDefaultAsync(c => c.UserId == userId);

        if (cart == null || !cart.Items.Any())
        {
            throw new Exception("Cannot checkout with an empty cart.");
        }

        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var orderItems = new List<OrderItem>();
            decimal subtotal = 0;

            foreach (var cartItem in cart.Items)
            {
                var product = cartItem.Product;
                if (product == null)
                {
                    throw new NotFoundException($"Product in cart no longer exists.");
                }

                if (product.StockQuantity < cartItem.Quantity)
                {
                    throw new Exception($"Product {product.Name} is out of stock. Only {product.StockQuantity} items left.");
                }

                product.StockQuantity -= cartItem.Quantity;
                product.UpdatedAt = DateTime.UtcNow;

                var orderItem = new OrderItem
                {
                    ProductId = product.Id,
                    Price = product.Price,
                    Quantity = cartItem.Quantity
                };

                orderItems.Add(orderItem);
                subtotal += product.Price * cartItem.Quantity;
            }

            decimal shippingPrice = 50.00m; 

            var order = new Order
            {
                UserId = userId,
                OrderDate = DateTime.UtcNow,
                ShippingStreet = dto.ShippingStreet,
                ShippingCity = dto.ShippingCity,
                ShippingPostalCode = dto.ShippingPostalCode,
                ShippingCountry = dto.ShippingCountry,
                Subtotal = subtotal,
                ShippingPrice = shippingPrice,
                Status = OrderStatus.Pending,
                OrderItems = orderItems
            };

            _context.Orders.Add(order);
            await _context.SaveChangesAsync();

            _context.CartItems.RemoveRange(cart.Items);
            await _context.SaveChangesAsync();

            await transaction.CommitAsync();

            var createdOrder = await _context.Orders
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.Product)
                .FirstAsync(o => o.Id == order.Id);

            return createdOrder.ToDto();
        }
        catch (Exception)
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<OrderDto> GetOrderByIdAsync(string userId, int orderId)
    {
        var order = await _context.Orders
            .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Product)
            .FirstOrDefaultAsync(o => o.Id == orderId && o.UserId == userId);

        if (order == null)
        {
            throw new NotFoundException($"Order with ID {orderId} not found.");
        }

        return order.ToDto();
    }

    public async Task<IEnumerable<OrderDto>> GetOrdersForUserAsync(string userId)
    {
        var orders = await _context.Orders
            .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Product)
            .Where(o => o.UserId == userId)
            .OrderByDescending(o => o.OrderDate)
            .ToListAsync();

        return orders.Select(o => o.ToDto()).ToList();
    }

    public async Task<IEnumerable<OrderDto>> GetAllOrdersAsync()
    {
        var orders = await _context.Orders
            .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Product)
            .OrderByDescending(o => o.OrderDate)
            .ToListAsync();

        return orders.Select(o => o.ToDto()).ToList();
    }

    public async Task UpdateOrderStatusAsync(int orderId, string status)
    {
        var order = await _context.Orders.FindAsync(orderId);
        if (order == null)
        {
            throw new NotFoundException($"Order with ID {orderId} not found.");
        }

        if (!Enum.TryParse<OrderStatus>(status, true, out var orderStatus))
        {
            throw new Exception($"Invalid order status. Supported: {string.Join(", ", Enum.GetNames(typeof(OrderStatus)))}");
        }

        order.Status = orderStatus;
        order.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
    }
}
