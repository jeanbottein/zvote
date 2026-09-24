package org.zvote.server.architecture;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

/**
 * Executable architecture rules. The shape they enforce is deliberately small:
 *
 *   polls    - what is being decided. Knows nothing about voting systems.
 *   ballots  - one package per voting system, each ignorant of the others.
 *   api      - the only layer that knows about both, because composing a poll
 *              with its results is inherently a job for both.
 *   identity - who is voting.
 *   live     - pushing changes to watchers; knows nothing about what it pushes.
 *   common   - configuration and the shared "invalid request" error.
 *
 * Anything more elaborate (ports and adapters, an interface per implementation,
 * a mapper per boundary) would cost more to understand than it buys at this size.
 */
class ArchitectureTest {

    private static JavaClasses classes;

    @BeforeAll
    static void importClasses() {
        classes = new ClassFileImporter()
            .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
            .importPackages("org.zvote.server");
    }

    @Test
    void pollsDoNotKnowAboutVotingSystems() {
        noClasses()
            .that().resideInAPackage("..polls..")
            .should().dependOnClassesThat().resideInAPackage("..ballots..")
            .because("a poll is the question, not how it is answered")
            .check(classes);
    }

    @Test
    void votingSystemsDoNotDependOnEachOther() {
        noClasses()
            .that().resideInAPackage("..ballots.approval..")
            .should().dependOnClassesThat().resideInAPackage("..ballots.judgment..")
            .because("each voting system must stand alone")
            .check(classes);

        noClasses()
            .that().resideInAPackage("..ballots.judgment..")
            .should().dependOnClassesThat().resideInAPackage("..ballots.approval..")
            .because("each voting system must stand alone")
            .check(classes);
    }

    @Test
    void onlyTheApiKnowsAboutHttp() {
        noClasses()
            .that().resideInAnyPackage("..polls..", "..ballots..", "..live..", "..identity..", "..common..")
            .should().dependOnClassesThat().resideInAPackage("..api..")
            .because("the domain must not know how it is exposed")
            .check(classes);
    }

    @Test
    void infrastructureKnowsNothingAboutTheDomain() {
        noClasses()
            .that().resideInAnyPackage("..live..", "..identity..")
            .should().dependOnClassesThat().resideInAnyPackage("..polls..", "..ballots..")
            .because("pushing events and recognising voters work the same whatever is being voted on")
            .check(classes);
    }

    @Test
    void repositoriesAreOnlyUsedByServices() {
        classes()
            .that().haveSimpleNameEndingWith("Repository")
            .should().onlyBeAccessed().byClassesThat().haveSimpleNameEndingWith("Service")
            .because("the rules live in services; a controller reaching for a repository would walk past them")
            .check(classes);
    }

    @Test
    void repositoriesAreAnnotatedInterfaces() {
        classes()
            .that().haveSimpleNameEndingWith("Repository")
            .should().beInterfaces()
            .andShould().beAnnotatedWith(org.springframework.stereotype.Repository.class)
            .check(classes);
    }

    @Test
    void servicesAreAnnotated() {
        classes()
            .that().haveSimpleNameEndingWith("Service")
            .should().beAnnotatedWith(org.springframework.stereotype.Service.class)
            .check(classes);
    }

    @Test
    void controllersAreAnnotated() {
        classes()
            .that().haveSimpleNameEndingWith("Controller")
            .should().beAnnotatedWith(org.springframework.web.bind.annotation.RestController.class)
            .check(classes);
    }

    @Test
    void dataIsImmutable() {
        classes()
            .that().resideInAPackage("..dto..")
            .should().beRecords()
            .because("request and response shapes are data, not objects with behaviour")
            .check(classes);

        // Entities carry no @Table annotation (it would make their table name a
        // quoted identifier), so they are recognised structurally: everything in
        // the domain that is not a service, repository, exception or enum.
        classes()
            .that().resideInAnyPackage("..polls..", "..ballots..")
            .and().areTopLevelClasses()   // skips synthetic switch-map classes
            .and().areNotInterfaces()
            .and().areNotEnums()
            .and().haveSimpleNameNotEndingWith("Service")
            .and().haveSimpleNameNotEndingWith("Exception")
            .should().beRecords()
            .because("immutable entities are why this project uses Spring Data JDBC, "
                + "and JPA cannot map records at all")
            .check(classes);
    }

    @Test
    void nothingIsReactive() {
        noClasses()
            .that().resideInAPackage("org.zvote.server..")
            .should().dependOnClassesThat().resideInAnyPackage("reactor..", "org.reactivestreams..")
            .because("the server is blocking code on virtual threads by design; a stray Mono or Flux "
                + "brings back the programming model that was removed")
            .check(classes);
    }
}
