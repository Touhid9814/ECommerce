using System.Collections.Generic;
using System.Threading.Tasks;
using Ecommerce.Application.DTOs;

namespace Ecommerce.Application.Interfaces;

public interface IOrderService
{
    Task<OrderDto> CreateOrderAsync(string userId, OrderCreateDto dto);
    Task<OrderDto> GetOrderByIdAsync(string userId, int orderId);
    Task<IEnumerable<OrderDto>> GetOrdersForUserAsync(string userId);
    Task<IEnumerable<OrderDto>> GetAllOrdersAsync();
    Task UpdateOrderStatusAsync(int orderId, string status);
}
