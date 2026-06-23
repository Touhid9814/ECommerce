using System.Collections.Generic;

namespace Ecommerce.Domain.Entities;

public class Cart : BaseEntity
{
    public string UserId { get; set; } = string.Empty;
    
    // Navigation property
    public ICollection<CartItem> Items { get; set; } = new List<CartItem>();
}
