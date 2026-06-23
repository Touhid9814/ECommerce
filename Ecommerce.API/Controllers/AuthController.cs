using Microsoft.AspNetCore.Mvc;
using Ecommerce.Application.DTOs;
using Ecommerce.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using FluentValidation;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace Ecommerce.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly IValidator<RegisterDto> _registerValidator;

    public AuthController(IAuthService authService, IValidator<RegisterDto> registerValidator)
    {
        _authService = authService;
        _registerValidator = registerValidator;
    }

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponseDto>> Register(RegisterDto dto)
    {
        var validationResult = await _registerValidator.ValidateAsync(dto);
        if (!validationResult.IsValid)
        {
            return BadRequest(new { Errors = validationResult.Errors.Select(e => e.ErrorMessage) });
        }

        try
        {
            var response = await _authService.RegisterAsync(dto);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponseDto>> Login(LoginDto dto)
    {
        try
        {
            var response = await _authService.LoginAsync(dto);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpPost("assign-role")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AssignRole(RoleAssignmentDto dto)
    {
        try
        {
            await _authService.AssignRoleAsync(dto.Email, dto.Role);
            return Ok(new { Message = $"Role {dto.Role} successfully assigned to user {dto.Email}." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }
}
