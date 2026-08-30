"use client";

import * as React from "react";
import { LayoutGroup, motion, useAnimate, delay } from "motion/react";

// Ported from animate-ui's registry (registry/components/community/radial-intro) -
// TS types stripped, logic unchanged. Each orbit item gets its own "arm"
// (a full-size absolutely-positioned div rotated to its angle) with the
// image counter-rotated inside it so the photo itself always stays
// upright while its arm sweeps around - then both keep spinning
// indefinitely once the initial placement animation settles.
const transition = {
  delay: 0,
  stiffness: 300,
  damping: 35,
  type: "spring",
  restSpeed: 0.01,
  restDelta: 0.01,
};

const spinConfig = {
  duration: 30,
  ease: "linear",
  repeat: Infinity,
};

const qsa = (root, sel) => Array.from(root.querySelectorAll(sel));
const angleOf = (el) => Number(el.dataset.angle || 0);
const armOfImg = (img) => img.closest("[data-arm]");

function RadialIntro({ orbitItems, stageSize = 320, imageSize = 60 }) {
  const step = 360 / orbitItems.length;
  const [scope, animate] = useAnimate();

  React.useEffect(() => {
    const root = scope.current;
    if (!root) return;

    const arms = qsa(root, "[data-arm]");
    const imgs = qsa(root, "[data-arm-image]");
    const stops = [];

    delay(() => animate(imgs, { top: 0 }, transition), 250);

    const orbitPlacementSequence = [
      ...arms.map((el) => [el, { rotate: angleOf(el) }, { ...transition, at: 0 }]),
      ...imgs.map((img) => [
        img,
        { rotate: -angleOf(armOfImg(img)), opacity: 1 },
        { ...transition, at: 0 },
      ]),
    ];

    delay(() => animate(orbitPlacementSequence), 700);

    delay(() => {
      arms.forEach((el) => {
        const angle = angleOf(el);
        const ctrl = animate(el, { rotate: [angle, angle + 360] }, spinConfig);
        stops.push(() => ctrl.cancel());
      });

      imgs.forEach((img) => {
        const arm = armOfImg(img);
        const angle = arm ? angleOf(arm) : 0;
        const ctrl = animate(img, { rotate: [-angle, -angle - 360] }, spinConfig);
        stops.push(() => ctrl.cancel());
      });
    }, 1300);

    return () => stops.forEach((stop) => stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <LayoutGroup>
      <motion.div
        ref={scope}
        className="relative overflow-visible"
        style={{ width: stageSize, height: stageSize }}
        initial={false}
      >
        {orbitItems.map((item, i) => (
          <motion.div
            key={item.id}
            data-arm
            className="will-change-transform absolute inset-0"
            style={{ zIndex: orbitItems.length - i }}
            data-angle={i * step}
            layoutId={`arm-${item.id}`}
          >
            <motion.img
              data-arm-image
              className="rounded-full object-cover absolute left-1/2 top-1/2 aspect-square -translate-x-1/2"
              style={{
                width: imageSize,
                height: imageSize,
                opacity: i === 0 ? 1 : 0,
              }}
              src={item.src}
              alt={item.name}
              draggable={false}
              layoutId={`arm-img-${item.id}`}
            />
          </motion.div>
        ))}
      </motion.div>
    </LayoutGroup>
  );
}

export { RadialIntro };
