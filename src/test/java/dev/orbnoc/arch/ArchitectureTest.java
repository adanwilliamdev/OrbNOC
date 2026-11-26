package dev.orbnoc.arch;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

/** Regras de arquitetura: o núcleo (core) é Java puro e as camadas só dependem "para dentro". */
@AnalyzeClasses(packages = "dev.orbnoc", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {

    @ArchTest
    static final ArchRule coreNaoDependeDeSpringNemDasOutrasCamadas = noClasses()
            .that()
            .resideInAPackage("dev.orbnoc.core..")
            .should()
            .dependOnClassesThat()
            .resideInAnyPackage(
                    "org.springframework..",
                    "dev.orbnoc.service..",
                    "dev.orbnoc.repo..",
                    "dev.orbnoc.web..",
                    "dev.orbnoc.ws..",
                    "dev.orbnoc.config..");

    @ArchTest
    static final ArchRule repositoriosNaoDependemDeServicosNemDaWeb = noClasses()
            .that()
            .resideInAPackage("dev.orbnoc.repo..")
            .should()
            .dependOnClassesThat()
            .resideInAnyPackage("dev.orbnoc.service..", "dev.orbnoc.web..", "dev.orbnoc.ws..");

    @ArchTest
    static final ArchRule servicosNaoDependemDaCamadaWebDeTela = noClasses()
            .that()
            .resideInAPackage("dev.orbnoc.service..")
            .should()
            .dependOnClassesThat()
            .resideInAPackage("dev.orbnoc.web.ui..");
}
