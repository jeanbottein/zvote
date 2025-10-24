package org.zvote.server.config;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsRuntimeWiring;
import graphql.schema.Coercing;
import graphql.schema.CoercingParseLiteralException;
import graphql.schema.CoercingParseValueException;
import graphql.schema.CoercingSerializeException;
import graphql.schema.GraphQLScalarType;
import graphql.schema.idl.RuntimeWiring;

/**
 * GraphQL scalar type implementations for custom types.
 * Registers the Long scalar type for use in GraphQL schema.
 */
@DgsComponent
public class GraphQLScalarConfig {

    /**
     * Register custom scalar types with DGS runtime wiring.
     * This ensures DGS can find and use the Long scalar type.
     */
    @DgsRuntimeWiring
    public static RuntimeWiring.Builder addScalars(RuntimeWiring.Builder builder) {
        return builder.scalar(createLongScalar());
    }

    /**
     * Create the Long scalar type definition.
     * Handles conversion between GraphQL Long and Java Long.
     */
    private static GraphQLScalarType createLongScalar() {
        return GraphQLScalarType.newScalar()
                .name("Long")
                .description("Long scalar type")
                .coercing(new Coercing<Long, Long>() {
                    @Override
                    public Long serialize(Object dataFetcherResult) throws CoercingSerializeException {
                        if (dataFetcherResult instanceof Number) {
                            return ((Number) dataFetcherResult).longValue();
                        }
                        throw new CoercingSerializeException("Cannot serialize " + dataFetcherResult + " as Long");
                    }

                    @Override
                    public Long parseValue(Object input) throws CoercingParseValueException {
                        if (input instanceof Number) {
                            return ((Number) input).longValue();
                        }
                        if (input instanceof String) {
                            try {
                                return Long.parseLong((String) input);
                            } catch (NumberFormatException e) {
                                throw new CoercingParseValueException("Cannot parse value " + input + " as Long", e);
                            }
                        }
                        throw new CoercingParseValueException("Cannot parse value " + input + " as Long");
                    }

                    @Override
                    public Long parseLiteral(Object input) throws CoercingParseLiteralException {
                        if (input instanceof Number) {
                            return ((Number) input).longValue();
                        }
                        if (input instanceof String) {
                            try {
                                return Long.parseLong((String) input);
                            } catch (NumberFormatException e) {
                                throw new CoercingParseLiteralException("Cannot parse literal " + input + " as Long", e);
                            }
                        }
                        throw new CoercingParseLiteralException("Cannot parse literal " + input + " as Long");
                    }
                })
                .build();
    }
}
