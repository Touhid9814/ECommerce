using System.Threading.Tasks;

namespace Ecommerce.Application.Interfaces;

public interface IPaymentService
{
    Task<string> CreatePaymentSessionAsync(int orderId, decimal amount, string currency);
    Task<bool> VerifyPaymentAsync(string transactionReference);
}
