package org.zvote.server;

import com.netflix.graphql.dgs.DgsQueryExecutor;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.graphql.test.tester.GraphQlTester;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration tests to validate GraphQL schema loads correctly
 * and all types are properly defined.
 */
@SpringBootTest
public class GraphQLSchemaValidationTest {

    @Autowired(required = false)
    private DgsQueryExecutor dgsQueryExecutor;

    @Test
    public void testGraphQLSchemaLoadsSuccessfully() {
        // If schema has errors, the application context won't load
        // This test verifies the schema is valid by checking that
        // the DgsQueryExecutor is available (it would fail to inject if schema was invalid)
        assertNotNull(dgsQueryExecutor, "DgsQueryExecutor should be available if schema is valid");
    }
}
