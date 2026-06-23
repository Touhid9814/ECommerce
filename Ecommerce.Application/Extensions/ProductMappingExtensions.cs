using Ecommerce.Domain.Entities;
using Ecommerce.Application.DTOs;

namespace Ecommerce.Application.Extensions;

public static class ProductMappingExtensions
{
    public static ProductDto ToDto(this Product product)
    {
        return new ProductDto
        {
            Id = product.Id,
            Name = product.Name,
            Description = product.Description,
            Price = product.Price,
            ImageUrl = product.ImageUrl,
            StockQuantity = product.StockQuantity,
            CategoryId = product.CategoryId,
            CategoryName = product.Category != null ? product.Category.Name : string.Empty,
            BrandId = product.BrandId,
            BrandName = product.Brand != null ? product.Brand.Name : string.Empty
        };
    }
}
