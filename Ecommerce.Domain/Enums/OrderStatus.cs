namespace Ecommerce.Domain.Enums;

public enum OrderStatus
{
    Pending,
    PaymentReceived,
    PaymentFailed,
    Shipped,
    Cancelled
}
