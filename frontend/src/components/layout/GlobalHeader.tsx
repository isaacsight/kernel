import {
    Header,
    HeaderContainer,
    HeaderName,
    HeaderNavigation,
    HeaderMenuButton,
    HeaderMenuItem,
    HeaderGlobalBar,
    HeaderGlobalAction,
    SkipToContent,
    Tag,
} from '@carbon/react';
import { Search, User, Settings, Terminal as TerminalIcon } from '@carbon/icons-react';
import { Link, useLocation } from 'react-router-dom';

const GlobalHeader = () => {
    const location = useLocation();

    return (
        <HeaderContainer
            render={({ isSideNavExpanded, onClickSideNavExpand }) => (
                <Header aria-label="Does This Feel Right">
                    <SkipToContent />
                    <HeaderMenuButton
                        aria-label="Open menu"
                        isCollapsible
                        onClick={onClickSideNavExpand}
                        isActive={isSideNavExpanded}
                    />
                    <HeaderName as={Link} to="/" prefix="DTFR">
                        System Compiler
                    </HeaderName>
                    <HeaderNavigation aria-label="System Compiler">
                        <HeaderMenuItem as={Link} to="/" isActive={location.pathname === '/'}>
                            Home
                        </HeaderMenuItem>
                        <HeaderMenuItem as={Link} to="/chat" isActive={location.pathname === '/chat'}>
                            Studio
                        </HeaderMenuItem>
                        <HeaderMenuItem as={Link} to="/intelligence" isActive={location.pathname === '/intelligence'}>
                            Intelligence
                        </HeaderMenuItem>
                    </HeaderNavigation>

                    <div className="cds--header__global" style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingRight: '16px' }}>
                        <Tag type="blue" size="sm" title="Version">v2.1.0-alpha</Tag>
                        <Tag type="cool-gray" size="sm">OSS Native Runtime</Tag>
                        <Tag type="purple" size="sm">Phase 1: HARNESS</Tag>
                        <Tag type="green" size="sm" renderIcon={TerminalIcon}>LIVE</Tag>
                    </div>

                    <HeaderGlobalBar>
                        <HeaderGlobalAction aria-label="Search" onClick={() => { }}>
                            <Search size={20} />
                        </HeaderGlobalAction>
                        <HeaderGlobalAction aria-label="User" onClick={() => { }}>
                            <User size={20} />
                        </HeaderGlobalAction>
                        <HeaderGlobalAction aria-label="Settings" onClick={() => { }}>
                            <Settings size={20} />
                        </HeaderGlobalAction>
                    </HeaderGlobalBar>
                </Header>
            )}
        />
    );
};

export default GlobalHeader;
