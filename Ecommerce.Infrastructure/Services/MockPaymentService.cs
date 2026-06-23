using System;
using System.Threading.Tasks;
using Ecommerce.Application.Interfaces;

namespace Ecommerce.Infrastructure.Services;

public class MockPaymentService : IPaymentService
{
    public Task<string> CreatePaymentSessionAsync(int orderId, decimal amount, string currency)
    {
        var transactionId = "TXN_MOCK_" + Guid.NewGuid().ToString().Substring(0, 8).ToUpper();
        var mockRedirectUrl = $"https://checkout.sandbox.com/pay?txnRef={transactionId}&orderId={orderId}&amount={amount}&currency={currency}";
        
        return Task.FromResult(mockRedirectUrl);
    }

    public Task<bool> VerifyPaymentAsync(string transactionReference)
    {
        if (transactionReference.StartsWith("TXN_MOCK_"))
        {
            return Task.FromResult(true);
        }
        return Task.FromResult(false);
    }
}
