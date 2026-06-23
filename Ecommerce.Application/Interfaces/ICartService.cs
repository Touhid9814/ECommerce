using System.Threading.Tasks;
using Ecommerce.Application.DTOs;

namespace Ecommerce.Application.Interfaces;

public interface ICartService
{
    Task<CartDto> GetCartByUserIdAsync(string userId);
    Task<CartDto> AddOrUpdateItemAsync(string userId, CartItemUpdateDto dto);
    Task<CartDto> RemoveItemAsync(string userId, int productId);
    Task ClearCartAsync(string userId);
}
