import { animated, useTransition } from "@react-spring/web";
import PropTypes from "prop-types";
import React, { useCallback, useState } from "react";
import { useEffectOnce } from "react-use";
import styled, { css } from "styled-components";

import { useSelector } from "@agir/front/globalContext/GlobalContext";
import { getUser } from "@agir/front/globalContext/reducers";
import { useColorScheme } from "@agir/front/theme/ThemeProvider";
import { useLocalStorage } from "@agir/lib/utils/hooks";

import Tooltip from "@agir/front/genericComponents/Tooltip";

const slideInTransition = {
  from: { opacity: 0, marginBottom: "-3rem" },
  enter: { opacity: 1, marginBottom: "0rem" },
  leave: { opacity: 0, marginBottom: "-3rem" },
};

const Button = styled.a`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: 100%;
  background-color: transparent;
  background-repeat: no-repeat;
  background-size: cover;
  background-position: center center;

  ${({ $scheme, theme }) =>
    $scheme === 'dark' &&
    css`
    color: ${theme.background0};
    &:hover {
      color: ${theme.background0};
    }`
  }

  ${({ $background }) =>
    $background
      ? css`
          background-image: url(${$background});
        `
      : css`
          background-color: ${(props) => props.theme.secondary500};
          &:hover {
            background-color: ${(props) => props.theme.secondary600};
          }
        `}

  &:hover {
    text-decoration: none;
  }

  i {
    font-size: 2em;
  }
`;

const Wrapper = styled(animated.div)`
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 50%;
  z-index: ${(props) => props.theme.zindexFloatButton};

  @media (max-width: ${(props) => props.theme.collapse}px) {
    width: 3rem;
    height: 3rem;
    bottom: 6.5rem;
  }
`;

export const FloatButton = (props) => {
  const [scheme] = useColorScheme();
  const { isActive, shouldPushTooltip, href, content, icon, label } = props;

  const [hasTooltip, setHasTooltip] = useState(false);

  const hideTooltip = useCallback(() => {
    setHasTooltip(false);
  }, []);

  const showTooltip = useCallback(() => {
    setHasTooltip(true);
  }, []);

  const pushTooltip = useCallback(() => {
    shouldPushTooltip && showTooltip();
  }, [shouldPushTooltip, showTooltip]);

  const wrapperTransition = useTransition(isActive, {
    ...slideInTransition,
    onRest: pushTooltip,
  });

  return wrapperTransition((style, item) =>
    item ? (
      <Wrapper style={{ ...(props.style || {}), ...style }}>
        <Tooltip
          position="top-left"
          shouldShow={hasTooltip}
          onClose={shouldPushTooltip ? hideTooltip : undefined}
        >
          {content}
        </Tooltip>
        <Button
          $background={props.background}
          $scheme={scheme}
          href={href}
          aria-label={label}
          onMouseOver={shouldPushTooltip ? undefined : showTooltip}
          onMouseLeave={shouldPushTooltip ? undefined : hideTooltip}
        >
          <i className={icon} />
        </Button>
      </Wrapper>
    ) : null,
  );
};
FloatButton.propTypes = {
  isActive: PropTypes.bool,
  shouldPushTooltip: PropTypes.bool,
  href: PropTypes.string,
};

const ConnectedFloatButton = (props) => {
  const user = useSelector(getUser);
  const [visitCount, setVisitCount] = useLocalStorage("AP_vcount", 0);
  const [shouldPushTooltip, setShouldPushTooltip] = useState(false);

  useEffectOnce(() => {
    const count = visitCount + 1;
    count % 20 === 3 && setShouldPushTooltip(true);
    setVisitCount(count);
  });

  return (
    <FloatButton
      {...props}
      shouldPushTooltip={shouldPushTooltip}
      isActive={!!user}
    />
  );
};
export default ConnectedFloatButton;
