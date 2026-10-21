package dev.orbnoc.repo;

import dev.orbnoc.domain.User;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findFirstByUsernameOrEmail(String username, String email);

    Optional<User> findByUsername(String username);

    boolean existsByUsername(String username);

    long countByRoleAndActiveTrue(String role);

    List<User> findAllByOrderByIdAsc();
}
