package org.zvote.server;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class ZVoteServerApplication {

    public static void main(String[] args) {
        SpringApplication.run(ZVoteServerApplication.class, args);
    }
}
