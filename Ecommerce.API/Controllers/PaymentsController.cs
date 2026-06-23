using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ecommerce.Application.Interfaces;
using Ecommerce.Infrastructure.Data;
using Ecommerce.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using System.Threading.Tasks;
using System;

namespace Ecommerce.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PaymentsController : ControllerBase
{
    private readonly IPaymentService _paymentService;
    private readonly ApplicationDbContext _context;

    public PaymentsController(IPaymentService paymentService, ApplicationDbContext context)
    {
        _paymentService = paymentService;
        _context = context;
    }

    [Authorize]
    [HttpPost("session/{orderId}")]
    public async Task<IActionResult> CreatePaymentSession(int orderId)
    {
        var order = await _context.Orders.FindAsync(orderId);
        if (order == null)
        {
            return NotFound("Order not found.");
        }

        if (order.Status != OrderStatus.Pending)
        {
            return BadRequest("Payment session can only be created for pending orders.");
        }

        var checkoutUrl = await _paymentService.CreatePaymentSessionAsync(order.Id, order.Total, "BDT");
        
        return Ok(new { CheckoutUrl = checkoutUrl });
    }

    [HttpPost("verify")]
    public async Task<IActionResult> VerifyPayment([FromQuery] string txnRef, [FromQuery] int orderId)
    {
        var isVerified = await _paymentService.VerifyPaymentAsync(txnRef);
        if (!isVerified)
        {
            return BadRequest(new { Message = "Payment verification failed." });
        }

        var order = await _context.Orders
            .Include(o => o.OrderItems)
            .FirstOrDefaultAsync(o => o.Id == orderId);

        if (order == null)
        {
            return NotFound("Order not found.");
        }

        if (order.Status == OrderStatus.Pending)
        {
            order.Status = OrderStatus.PaymentReceived;
            order.PaymentIntentId = txnRef;
            order.UpdatedAt = DateTime.UtcNow;
            
            await _context.SaveChangesAsync();
        }

        return Ok(new { Message = "Payment verified successfully.", OrderStatus = order.Status.ToString() });
    }
}
