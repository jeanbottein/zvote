package org.zvote.server.architecture;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.lang.ArchRule;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.*;
import static com.tngtech.archunit.library.Architectures.layeredArchitecture;

/**
 * Architecture validation using ArchUnit
 * Ensures feature-based packaging and clean architecture principles
 */
class ArchitectureTest {

    private static JavaClasses importedClasses;

    @BeforeAll
    static void setUp() {
        importedClasses = new ClassFileImporter()
            .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
            .importPackages("org.zvote.server");
    }

    @Test
    void featuresShouldNotDependOnEachOther() {
        // Vote management should not depend on voting systems and vice versa
        ArchRule rule = noClasses()
            .that().resideInAPackage("..votemanagement..")
            .should().dependOnClassesThat().resideInAPackage("..votingsystems..");

        rule.check(importedClasses);
    }

    @Test
    void repositoriesShouldOnlyBeAccessedByServices() {
        ArchRule rule = classes()
            .that().haveNameMatching(".*Repository")
            .should().onlyBeAccessed().byClassesThat()
            .haveNameMatching(".*Service.*|.*Configuration.*");

        rule.check(importedClasses);
    }

    @Test
    void servicesShouldNotDependOnGraphQLLayer() {
        ArchRule rule = noClasses()
            .that().haveNameMatching(".*Service")
            .should().dependOnClassesThat().haveNameMatching(".*DataFetcher.*");

        rule.check(importedClasses);
    }

    @Test
    void entitiesShouldBeRecords() {
        ArchRule rule = classes()
            .that().resideInAPackage("..votemanagement..")
            .and().haveSimpleNameEndingWith("Vote")
            .or().haveSimpleNameEndingWith("Option")
            .or().haveSimpleNameEndingWith("Approval")
            .or().haveSimpleNameEndingWith("Judgment")
            .should().beRecords();

        rule.check(importedClasses);
    }

    @Test
    void dtosShouldBeRecords() {
        ArchRule rule = classes()
            .that().resideInAPackage("..dto..")
            .should().beRecords();

        rule.check(importedClasses);
    }

    @Test
    void servicesShouldBeAnnotatedWithService() {
        ArchRule rule = classes()
            .that().haveSimpleNameEndingWith("Service")
            .should().beAnnotatedWith(org.springframework.stereotype.Service.class);

        rule.check(importedClasses);
    }

    @Test
    void repositoriesShouldBeInterfaces() {
        ArchRule rule = classes()
            .that().haveSimpleNameEndingWith("Repository")
            .should().beInterfaces()
            .andShould().beAnnotatedWith(org.springframework.stereotype.Repository.class);

        rule.check(importedClasses);
    }

    @Test
    void dataFetchersShouldBeAnnotatedWithDgsComponent() {
        ArchRule rule = classes()
            .that().haveSimpleNameEndingWith("DataFetcher")
            .should().beAnnotatedWith(com.netflix.graphql.dgs.DgsComponent.class);

        rule.check(importedClasses);
    }
}
