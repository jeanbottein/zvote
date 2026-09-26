package org.zvote.server.architecture;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;
import org.zvote.server.ZVoteServerApplication;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

/**
 * Executable architecture rules.
 *
 * Each package under org.zvote.server is a module, and its package-info.java
 * says which modules it may depend on: polls on common only; approval,
 * judgment, identity, live and common on none; the api on all of them.
 * Spring Modulith verifies those declarations, that no module reaches into
 * another's sub-packages, and that there are no cycles. The rules below are
 * the ones a module declaration cannot state.
 *
 * Anything more elaborate (ports and adapters, an interface per implementation,
 * a mapper per boundary) would cost more to understand than it buys at this size.
 */
class ArchitectureTest {

    static final JavaClasses classes = new ClassFileImporter()
        .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
        .importPackages("org.zvote.server");

    @Test
    void modulesOnlyUseWhatTheyDeclare() {
        ApplicationModules.of(ZVoteServerApplication.class).verify();
    }

    @Test
    void repositoriesAreOnlyReachableFromTheServiceBesideThem() {
        classes()
            .that().haveSimpleNameEndingWith("Repository")
            .should().beInterfaces()
            .andShould().notBePublic()
            .andShould().onlyBeAccessed().byClassesThat().haveSimpleNameEndingWith("Service")
            .because("the rules live in services; a repository within reach would let code walk past them")
            .check(classes);
    }

    @Test
    void dataIsImmutable() {
        classes()
            .that().resideInAPackage("..dto..")
            .should().beRecords()
            .because("request and response shapes are data, not objects with behaviour")
            .check(classes);

        // Entities are recognised structurally: everything in the domain modules
        // that is not a service, a repository, an exception or an enum.
        classes()
            .that().resideInAnyPackage("..polls..", "..approval..", "..judgment..")
            .and().areTopLevelClasses()   // skips synthetic switch-map classes
            .and().areNotInterfaces()     // repositories, and package-info
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
            .should().dependOnClassesThat().resideInAnyPackage("reactor..", "org.reactivestreams..")
            .because("the server is blocking code on virtual threads by design; a stray Mono or Flux "
                + "brings back the programming model that was removed")
            .check(classes);
    }
}
