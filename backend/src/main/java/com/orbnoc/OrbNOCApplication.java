package com.orbnoc;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class OrbNOCApplication {
    public static void main(String[] args) {
        SpringApplication.run(OrbNOCApplication.class, args);
        System.out.println("🚀 OrbNOC Backend rodando em http://localhost:8080");
    }
}