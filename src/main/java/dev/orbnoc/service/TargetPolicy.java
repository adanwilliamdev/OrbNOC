package dev.orbnoc.service;

import dev.orbnoc.config.OrbNocProperties;
import dev.orbnoc.core.CidrList;
import dev.orbnoc.core.NetGuard;
import dev.orbnoc.repo.UserRepository;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Política de alvos por papel. Admins seguem só ALLOW_PRIVATE_NETWORKS; usuários comuns, se
 * USER_ALLOWED_CIDRS estiver definida, só alcançam redes privadas dentro dessas faixas (o que
 * impede varrer a rede interna do servidor por monitores, /ports e /traceroute).
 */
@Service
public class TargetPolicy {

    private static final long DNS_TIMEOUT_MS = 5000;

    private final OrbNocProperties props;
    private final UserRepository users;
    private final CidrList userCidrs;

    public TargetPolicy(OrbNocProperties props, UserRepository users) {
        this.props = props;
        this.users = users;
        this.userCidrs = props.userCidrs();
    }

    /** Resolve e valida o host; lança HostRejectedException se algum endereço for proibido. */
    public List<String> resolve(String host, boolean admin) {
        return NetGuard.resolveAndCheck(host, props.allowPrivateNetworks(), admin ? CidrList.EMPTY : userCidrs, DNS_TIMEOUT_MS);
    }

    public List<String> resolveForUser(String host, Long userId) {
        return resolve(host, isAdmin(userId));
    }

    public boolean isAdmin(Long userId) {
        return users.findById(userId).map(u -> "admin".equals(u.getRole())).orElse(false);
    }
}
