using System.ComponentModel.DataAnnotations;

namespace Ecommerce.Application.DTOs;

public class RoleAssignmentDto
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Role { get; set; } = string.Empty;
}
