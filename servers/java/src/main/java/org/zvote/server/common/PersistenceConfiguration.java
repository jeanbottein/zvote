package org.zvote.server.common;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.convert.ConverterBuilder;
import org.springframework.data.jdbc.core.convert.JdbcCustomConversions;
import org.springframework.data.jdbc.core.dialect.JdbcDialect;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * How Spring Data JDBC reads what the database returns.
 *
 * TIMESTAMP WITH TIME ZONE columns come back as OffsetDateTime, and the
 * entities hold Instant. Without a converter Spring finds
 * OffsetDateTime.toInstant() by reflection at run time, which a native image
 * does not allow: this one says so outright, and works on both.
 */
@Configuration(proxyBeanMethods = false)
class PersistenceConfiguration {

    @Bean
    JdbcCustomConversions jdbcCustomConversions(JdbcDialect dialect) {
        return JdbcCustomConversions.of(dialect,
            List.of(ConverterBuilder.reading(OffsetDateTime.class, Instant.class, OffsetDateTime::toInstant)));
    }
}
