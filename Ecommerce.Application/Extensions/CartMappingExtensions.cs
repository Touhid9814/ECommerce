using System.Linq;
using Ecommerce.Domain.Entities;
using Ecommerce.Application.DTOs;

namespace Ecommerce.Application.Extensions;

public static class CartMappingExtensions
{
    public static CartItemDto ToDto(this CartItem item)
    {
        return new CartItemDto
        {
            ProductId = item.ProductId,
            ProductName = item.Product != null ? item.Product.Name : string.Empty,
            ImageUrl = item.Product != null ? item.Product.ImageUrl : string.Empty,
            Price = item.Product != null ? item.Product.Price : 0,
            Quantity = item.Quantity
        };
    }

    public static CartDto ToDto(this Cart cart)
    {
        return new CartDto
        {
            Id = cart.Id,
            UserId = cart.UserId,
            Items = cart.Items != null 
                ? cart.Items.Select(i => i.ToDto()).ToList() 
                : new System.Collections.Generic.List<CartItemDto>()
        };
    }
}
