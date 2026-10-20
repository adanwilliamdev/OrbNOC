package com.orbnoc.controller;

import com.orbnoc.model.User;
import com.orbnoc.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "http://localhost:4200")
public class AuthController {

    private final UserRepository repository;
    public AuthController(UserRepository repository) { this.repository = repository; }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody User user) {
        if (repository.findByUsername(user.getUsername()).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Usuario ja existe."));
        }
        if (repository.findByEmail(user.getEmail()).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("message", "E-mail ja cadastrado."));
        }
        // Simulando um hash simples (em producao use BCrypt)
        user.setPassword(user.getPassword() + "_hashed");
        repository.save(user);
        return ResponseEntity.ok(Map.of("message", "Cadastro realizado com sucesso!"));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> credentials) {
        String username = credentials.get("username");
        String password = credentials.get("password") + "_hashed";

        Optional<User> userOpt = repository.findByUsername(username);
        if (userOpt.isPresent() && userOpt.get().getPassword().equals(password)) {
            User u = userOpt.get();
            Map<String, Object> response = new HashMap<>();
            // Simulando um token JWT
            response.put("token", "fake-jwt-token-" + UUID.randomUUID().toString());
            response.put("user", Map.of(
                "id", u.getId(),
                "username", u.getUsername(),
                "email", u.getEmail(),
                "role", u.getRole()
            ));
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Credenciais invalidas."));
    }
}