using System.Collections.Generic;
using System.Linq;

namespace Ecommerce.Application.DTOs;

public class CartDto
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public List<CartItemDto> Items { get; set; } = new List<CartItemDto>();
    public decimal TotalPrice => Items.Sum(x => x.Subtotal);
}
