package com.orbnoc.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;

@Service
@Slf4j
public class PingService {

    public PingResult ping(String ipAddress, int timeout) {
        long startTime = System.currentTimeMillis();

        try {

            Process process = Runtime.getRuntime().exec(
                    "ping -c 1 -W " + (timeout / 1000) + " " + ipAddress
            );

            BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream())
            );

            String line;
            while ((line = reader.readLine()) != null) {
                log.info(line);
            }

            int exitCode = process.waitFor();

            long latency = System.currentTimeMillis() - startTime;

            boolean reachable = exitCode == 0;

            return new PingResult(reachable, reachable ? latency : -1);

        } catch (IOException | InterruptedException e) {

            log.error("Erro ao executar ping para {}", ipAddress, e);

            return new PingResult(false, -1);
        }
    }

    public record PingResult(boolean reachable, long latency) {}
}