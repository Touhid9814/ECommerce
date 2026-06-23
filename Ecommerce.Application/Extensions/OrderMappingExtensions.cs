using System.Linq;
using Ecommerce.Domain.Entities;
using Ecommerce.Application.DTOs;

namespace Ecommerce.Application.Extensions;

public static class OrderMappingExtensions
{
    public static OrderItemDto ToDto(this OrderItem item)
    {
        return new OrderItemDto
        {
            ProductId = item.ProductId,
            ProductName = item.Product != null ? item.Product.Name : string.Empty,
            Price = item.Price,
            Quantity = item.Quantity
        };
    }

    public static OrderDto ToDto(this Order order)
    {
        return new OrderDto
        {
            Id = order.Id,
            UserId = order.UserId,
            OrderDate = order.OrderDate,
            ShippingStreet = order.ShippingStreet,
            ShippingCity = order.ShippingCity,
            ShippingPostalCode = order.ShippingPostalCode,
            ShippingCountry = order.ShippingCountry,
            Subtotal = order.Subtotal,
            ShippingPrice = order.ShippingPrice,
            Total = order.Total,
            Status = order.Status.ToString(),
            OrderItems = order.OrderItems != null
                ? order.OrderItems.Select(i => i.ToDto()).ToList()
                : new System.Collections.Generic.List<OrderItemDto>()
        };
    }
}
