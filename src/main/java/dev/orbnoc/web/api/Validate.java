package dev.orbnoc.web.api;

import java.util.regex.Pattern;

/** Validações de entrada (mensagens em português; erro 422). */
public final class Validate {

    private static final Pattern USERNAME = Pattern.compile("[A-Za-z0-9_.-]{3,100}");
    private static final Pattern EMAIL = Pattern.compile("[^@\\s]+@[^@\\s]+\\.[^@\\s]+");

    private Validate() {}

    public static void require(boolean condition, String message) {
        if (!condition) throw ApiException.unprocessable(message);
    }

    public static String password(String password) {
        require(password != null, "Informe a senha");
        require(password.length() >= 8, "A senha deve ter pelo menos 8 caracteres");
        require(password.length() <= 128, "A senha é longa demais");
        require(password.chars().anyMatch(Character::isLetter) && password.chars().anyMatch(Character::isDigit),
                "A senha deve conter letras e números");
        return password;
    }

    public static String username(String username) {
        require(username != null && USERNAME.matcher(username).matches(),
                "Usuário: 3 a 100 caracteres (letras, números, _ . -)");
        return username;
    }

    public static String email(String email) {
        require(email != null && email.length() <= 255 && EMAIL.matcher(email.strip()).matches(), "Email inválido");
        return email.strip().toLowerCase();
    }

    public static String text(String value, String field, int min, int max) {
        require(value != null && value.strip().length() >= min, field + ": campo obrigatório");
        require(value.length() <= max, field + ": máximo de " + max + " caracteres");
        return value.strip();
    }

    public static String optionalText(String value, String field, int max) {
        if (value == null || value.isBlank()) return null;
        require(value.length() <= max, field + ": máximo de " + max + " caracteres");
        return value.strip();
    }

    public static int range(Integer value, String field, int min, int max) {
        require(value != null && value >= min && value <= max, field + ": deve estar entre " + min + " e " + max);
        return value;
    }
}
