"""3D OpenGL + Pygame client for Đảo Đèn Lồng (Night 1: Đảo Bến)."""

from __future__ import annotations

import math
import sys
import time
import pygame
from OpenGL.GL import (
    GL_AMBIENT,
    GL_BLEND,
    GL_COLOR_BUFFER_BIT,
    GL_COLOR_MATERIAL,
    GL_DEPTH_BUFFER_BIT,
    GL_DEPTH_TEST,
    GL_DIFFUSE,
    GL_EXP2,
    GL_FOG,
    GL_FOG_COLOR,
    GL_FOG_DENSITY,
    GL_FOG_MODE,
    GL_LIGHT0,
    GL_LIGHTING,
    GL_LINES,
    GL_LINE_LOOP,
    GL_MODELVIEW,
    GL_ONE_MINUS_SRC_ALPHA,
    GL_POSITION,
    GL_PROJECTION,
    GL_QUADS,
    GL_RGBA,
    GL_SRC_ALPHA,
    GL_TEXTURE_2D,
    GL_TEXTURE_MAG_FILTER,
    GL_TEXTURE_MIN_FILTER,
    GL_TRIANGLE_FAN,
    GL_UNSIGNED_BYTE,
    GL_LINEAR,
    glBegin,
    glBindTexture,
    glBlendFunc,
    glClear,
    glClearColor,
    glColor3f,
    glColor4f,
    glDeleteTextures,
    glDisable,
    glEnable,
    glEnd,
    glFogf,
    glFogfv,
    glFogi,
    glGenTextures,
    glLightfv,
    glLoadIdentity,
    glMatrixMode,
    glNormal3f,
    glOrtho,
    glPopMatrix,
    glPushMatrix,
    glRotatef,
    glScalef,
    glTexCoord2f,
    glTexImage2D,
    glTexParameteri,
    glTranslatef,
    glVertex3f,
    glViewport,
)
from OpenGL.GLU import gluLookAt, gluNewQuadric, gluPerspective, gluSphere, gluCylinder

from src.client.audio import SoundBank
from src.core.contract import load_tuning
from src.core.sim import DT, ISLAND_RADIUS, InputState, Simulation, create_simulation, step_tick

WIN_W, WIN_H = 1120, 700


def _draw_circle_xz(cx: float, cy: float, cz: float, radius: float, segments: int = 36, filled: bool = False) -> None:
    glBegin(GL_TRIANGLE_FAN if filled else GL_LINE_LOOP)
    if filled:
        glNormal3f(0.0, 1.0, 0.0)
        glVertex3f(cx, cy, cz)
    for i in range(segments + (1 if filled else 0)):
        ang = (2.0 * math.pi * i) / segments
        glVertex3f(cx + math.cos(ang) * radius, cy, cz + math.sin(ang) * radius)
    glEnd()


def _draw_box(sx: float, sy: float, sz: float) -> None:
    hx, hy, hz = sx * 0.5, sy * 0.5, sz * 0.5
    glBegin(GL_QUADS)
    # Front
    glNormal3f(0, 0, 1)
    glVertex3f(-hx, -hy, hz); glVertex3f(hx, -hy, hz); glVertex3f(hx, hy, hz); glVertex3f(-hx, hy, hz)
    # Back
    glNormal3f(0, 0, -1)
    glVertex3f(-hx, -hy, -hz); glVertex3f(-hx, hy, -hz); glVertex3f(hx, hy, -hz); glVertex3f(hx, -hy, -hz)
    # Top
    glNormal3f(0, 1, 0)
    glVertex3f(-hx, hy, -hz); glVertex3f(-hx, hy, hz); glVertex3f(hx, hy, hz); glVertex3f(hx, hy, -hz)
    # Bottom
    glNormal3f(0, -1, 0)
    glVertex3f(-hx, -hy, -hz); glVertex3f(hx, -hy, -hz); glVertex3f(hx, -hy, hz); glVertex3f(-hx, -hy, hz)
    # Right
    glNormal3f(1, 0, 0)
    glVertex3f(hx, -hy, -hz); glVertex3f(hx, hy, -hz); glVertex3f(hx, hy, hz); glVertex3f(hx, -hy, hz)
    # Left
    glNormal3f(-1, 0, 0)
    glVertex3f(-hx, -hy, -hz); glVertex3f(-hx, -hy, hz); glVertex3f(-hx, hy, hz); glVertex3f(-hx, hy, -hz)
    glEnd()


def _render_hud_surface(
    sim: Simulation,
    screen_mode: str,
    font_lg: pygame.font.Font,
    font_sm: pygame.font.Font,
) -> pygame.Surface:
    surf = pygame.Surface((WIN_W, WIN_H), pygame.SRCALPHA)
    lit_count = sum(1 for l in sim.lanterns if l.lit)
    total_lanterns = len(sim.lanterns)

    # Top HUD bar
    pygame.draw.rect(surf, (15, 10, 28, 175), (16, 14, WIN_W - 32, 54), border_radius=12)
    pygame.draw.rect(surf, (245, 178, 72, 140), (16, 14, WIN_W - 32, 54), width=2, border_radius=12)

    hud_items = [
        (f"Ngọn lửa: {sim.player.flames}/{sim.tuning.flames}", (255, 130, 100)),
        (f"Đom đóm: {sim.player.carried}/{sim.tuning.carry_capacity}", (255, 220, 95)),
        (f"Đèn Lồng: {lit_count}/{total_lanterns}", (255, 190, 75)),
        (f"Thời gian: {int(sim.time_left_s)}s", (215, 225, 255)),
        (f"Điểm: {sim.score}", (170, 255, 190)),
    ]
    x = 34
    for text, color in hud_items:
        img = font_sm.render(text, True, color)
        surf.blit(img, (x, 30))
        x += 215

    # Bottom controls hint
    hint = "WASD: Di chuyển | ←/→ hoặc Kéo chuột: Xoay cam | Space: Nhảy | E: Thắp đèn | F: Tỏa sáng (Pulse)"
    hint_img = font_sm.render(hint, True, (220, 215, 235))
    pygame.draw.rect(surf, (15, 10, 28, 150), (16, WIN_H - 42, WIN_W - 32, 30), border_radius=8)
    surf.blit(hint_img, (28, WIN_H - 36))

    if screen_mode == "start":
        pygame.draw.rect(surf, (14, 10, 26, 220), (180, 150, WIN_W - 360, 380), border_radius=18)
        pygame.draw.rect(surf, (250, 185, 70, 220), (180, 150, WIN_W - 360, 380), width=2, border_radius=18)
        lines = [
            ("ĐẢO ĐÈN LỒNG — ĐÊM 1: ĐẢO BẾN", font_lg, (255, 210, 100), 185),
            ("Sương đen đã nuốt trọn ánh sáng của hòn đảo giữa biển mây.", font_sm, (235, 230, 245), 255),
            ("Hãy cùng Mây thu thập đom đóm, thắp sáng 5 Đèn Lồng Lớn", font_sm, (235, 230, 245), 290),
            ("và dùng ánh sáng (F) xua tan Bóng Mực trước khi bình minh tới.", font_sm, (235, 230, 245), 325),
            ("Nhấn ENTER hoặc SPACE để bắt đầu", font_lg, (140, 255, 180), 425),
        ]
        for txt, fnt, col, y in lines:
            r = fnt.render(txt, True, col)
            surf.blit(r, ((WIN_W - r.get_width()) // 2, y))
    elif sim.state in ("won", "lost"):
        pygame.draw.rect(surf, (14, 10, 26, 225), (220, 180, WIN_W - 440, 310), border_radius=18)
        border_col = (255, 200, 80, 230) if sim.state == "won" else (210, 90, 140, 230)
        pygame.draw.rect(surf, border_col, (220, 180, WIN_W - 440, 310), width=2, border_radius=18)
        title = "ÁNH SÁNG ĐÃ TRỞ LẠI ĐẢO BẾN!" if sim.state == "won" else "NGỌN LỬA ĐÃ TẮT..."
        title_col = (255, 220, 110) if sim.state == "won" else (255, 130, 160)
        sub = f"Tổng điểm: {sim.score}  ·  Đèn đã thắp: {lit_count}/{total_lanterns}"
        lines = [
            (title, font_lg, title_col, 225),
            (sub, font_sm, (235, 235, 250), 295),
            ("Nhấn R hoặc ENTER để chơi lại", font_lg, (150, 255, 190), 385),
        ]
        for txt, fnt, col, y in lines:
            r = fnt.render(txt, True, col)
            surf.blit(r, ((WIN_W - r.get_width()) // 2, y))

    return surf


def _draw_hud_overlay(surf: pygame.Surface) -> None:
    data = pygame.image.tostring(surf, "RGBA", True)
    tex_id = glGenTextures(1)
    glBindTexture(GL_TEXTURE_2D, tex_id)
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR)
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR)
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, WIN_W, WIN_H, 0, GL_RGBA, GL_UNSIGNED_BYTE, data)

    glDisable(GL_DEPTH_TEST)
    glDisable(GL_LIGHTING)
    glDisable(GL_FOG)
    glEnable(GL_TEXTURE_2D)
    glEnable(GL_BLEND)
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA)

    glMatrixMode(GL_PROJECTION)
    glPushMatrix()
    glLoadIdentity()
    glOrtho(0, WIN_W, 0, WIN_H, -1, 1)
    glMatrixMode(GL_MODELVIEW)
    glPushMatrix()
    glLoadIdentity()

    glColor4f(1.0, 1.0, 1.0, 1.0)
    glBegin(GL_QUADS)
    glTexCoord2f(0, 0); glVertex3f(0, 0, 0)
    glTexCoord2f(1, 0); glVertex3f(WIN_W, 0, 0)
    glTexCoord2f(1, 1); glVertex3f(WIN_W, WIN_H, 0)
    glTexCoord2f(0, 1); glVertex3f(0, WIN_H, 0)
    glEnd()

    glPopMatrix()
    glMatrixMode(GL_PROJECTION)
    glPopMatrix()
    glMatrixMode(GL_MODELVIEW)

    glDisable(GL_BLEND)
    glDisable(GL_TEXTURE_2D)
    glEnable(GL_DEPTH_TEST)
    glDeleteTextures([tex_id])


def run_app() -> None:
    pygame.init()
    pygame.display.set_caption("Đảo Đèn Lồng — Đêm 1: Đảo Bến")
    pygame.display.set_mode((WIN_W, WIN_H), pygame.DOUBLEBUF | pygame.OPENGL)
    glViewport(0, 0, WIN_W, WIN_H)

    font_lg = pygame.font.SysFont("sans", 28, bold=True)
    font_sm = pygame.font.SysFont("sans", 18)
    sounds = SoundBank()
    tuning = load_tuning()
    quad = gluNewQuadric()

    def new_game() -> Simulation:
        return create_simulation(tuning=tuning, seed=int(time.time()) & 0xFFFF)

    sim = new_game()
    screen_mode = "start"
    cam_yaw_deg = 0.0
    pulse_ring_t = 0.0
    accumulator = 0.0
    last_time = time.perf_counter()
    clock = pygame.time.Clock()
    running = True

    while running:
        now = time.perf_counter()
        dt = min(0.05, now - last_time)
        last_time = now

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    running = False
                elif screen_mode == "start" and event.key in (pygame.K_RETURN, pygame.K_SPACE):
                    screen_mode = "play"
                elif sim.state in ("won", "lost") and event.key in (pygame.K_r, pygame.K_RETURN):
                    sim = new_game()
                    pulse_ring_t = 0.0
                    accumulator = 0.0
            elif event.type == pygame.MOUSEMOTION and pygame.mouse.get_pressed()[0]:
                cam_yaw_deg -= event.rel[0] * 0.35

        keys = pygame.key.get_pressed()
        if keys[pygame.K_LEFT]:
            cam_yaw_deg += 90.0 * dt
        if keys[pygame.K_RIGHT]:
            cam_yaw_deg -= 90.0 * dt

        if screen_mode == "play" and sim.state == "playing":
            mx = (1.0 if keys[pygame.K_d] else 0.0) - (1.0 if keys[pygame.K_a] else 0.0)
            mz = (1.0 if keys[pygame.K_w] else 0.0) - (1.0 if keys[pygame.K_s] else 0.0)
            curr_in = InputState(
                move_x=mx,
                move_z=mz,
                cam_yaw_deg=cam_yaw_deg,
                jump=bool(keys[pygame.K_SPACE]),
                interact=bool(keys[pygame.K_e]),
                pulse=bool(keys[pygame.K_f] or pygame.mouse.get_pressed()[2]),
            )
            accumulator += dt
            while accumulator >= DT and sim.state == "playing":
                events = step_tick(sim, curr_in)
                accumulator -= DT
                for ev in events:
                    name = ev["name"]
                    if name == "mote_picked":
                        sounds.play("mote")
                    elif name == "deposit":
                        sounds.play("deposit")
                    elif name == "lantern_lit":
                        sounds.play("lantern")
                    elif name == "pulse":
                        sounds.play("pulse")
                        pulse_ring_t = 0.55
                    elif name == "player_hit":
                        sounds.play("hit")

        if pulse_ring_t > 0.0:
            pulse_ring_t = max(0.0, pulse_ring_t - dt)

        # Render 3D Scene
        lit_ratio = sum(1 for l in sim.lanterns if l.lit) / max(1, len(sim.lanterns))
        bg_r = 0.05 + 0.07 * lit_ratio
        bg_g = 0.03 + 0.06 * lit_ratio
        bg_b = 0.09 + 0.08 * lit_ratio
        glClearColor(bg_r, bg_g, bg_b, 1.0)
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)

        glEnable(GL_DEPTH_TEST)
        glEnable(GL_LIGHTING)
        glEnable(GL_LIGHT0)
        glEnable(GL_COLOR_MATERIAL)
        glEnable(GL_FOG)
        glFogi(GL_FOG_MODE, GL_EXP2)
        glFogfv(GL_FOG_COLOR, (bg_r, bg_g, bg_b, 1.0))
        glFogf(GL_FOG_DENSITY, 0.022 - 0.010 * lit_ratio)

        glMatrixMode(GL_PROJECTION)
        glLoadIdentity()
        gluPerspective(55.0, WIN_W / WIN_H, 0.2, 160.0)
        glMatrixMode(GL_MODELVIEW)
        glLoadIdentity()

        px, py, pz = sim.player.pos
        yaw_rad = math.radians(cam_yaw_deg)
        cam_dist = 11.5
        cam_x = px - math.sin(yaw_rad) * cam_dist
        cam_z = pz - math.cos(yaw_rad) * cam_dist
        gluLookAt(cam_x, py + 6.2, cam_z, px, py + 1.0, pz, 0.0, 1.0, 0.0)

        glLightfv(GL_LIGHT0, GL_POSITION, (0.0, 22.0, 10.0, 1.0))
        glLightfv(GL_LIGHT0, GL_AMBIENT, (0.28 + 0.25 * lit_ratio, 0.22 + 0.2 * lit_ratio, 0.30, 1.0))
        glLightfv(GL_LIGHT0, GL_DIFFUSE, (0.85, 0.72, 0.55, 1.0))

        # Island ground
        glColor3f(0.14 + 0.08 * lit_ratio, 0.16 + 0.09 * lit_ratio, 0.18)
        _draw_circle_xz(0.0, 0.0, 0.0, ISLAND_RADIUS, segments=48, filled=True)
        glColor3f(0.45, 0.35, 0.22)
        _draw_circle_xz(0.0, 0.03, 0.0, ISLAND_RADIUS, segments=48, filled=False)

        # Lanterns
        for l in sim.lanterns:
            lx, _, lz = l.pos
            glPushMatrix()
            glTranslatef(lx, 0.0, lz)
            glColor3f(0.32, 0.22, 0.14)
            glPushMatrix()
            glTranslatef(0.0, 1.5, 0.0)
            _draw_box(0.45, 3.0, 0.45)
            glPopMatrix()

            if l.lit:
                glColor3f(1.0, 0.74, 0.24)
            else:
                frac = l.deposited / max(1, sim.tuning.lantern_cost)
                glColor3f(0.28 + 0.6 * frac, 0.22 + 0.4 * frac, 0.38 - 0.1 * frac)
            glPushMatrix()
            glTranslatef(0.0, 3.25, 0.0)
            _draw_box(0.95, 1.05, 0.95)
            glPopMatrix()
            glPopMatrix()

            if l.lit:
                glDisable(GL_LIGHTING)
                glColor3f(1.0, 0.68, 0.22)
                _draw_circle_xz(lx, 0.04, lz, sim.tuning.safe_radius, segments=32, filled=False)
                glEnable(GL_LIGHTING)

        # Motes (bobbing visually on Y)
        for idx, m in enumerate(sim.motes):
            bob = 0.75 + 0.22 * math.sin(now * 3.5 + idx)
            glPushMatrix()
            glTranslatef(m.pos[0], bob, m.pos[2])
            glColor3f(1.0, 0.86, 0.28)
            gluSphere(quad, 0.32, 12, 10)
            glPopMatrix()

        # Shades (Bóng Mực)
        for s in sim.shades:
            glPushMatrix()
            glTranslatef(s.pos[0], 0.9, s.pos[2])
            if s.state == "stunned":
                glColor3f(0.42, 0.55, 0.85)
            else:
                glColor3f(0.14, 0.06, 0.22)
            gluSphere(quad, 0.75, 14, 12)
            glPopMatrix()

        # Player Mây + Nón lá + Hanging Lantern
        glPushMatrix()
        glTranslatef(px, py, pz)
        glRotatef(cam_yaw_deg, 0.0, 1.0, 0.0)
        # Body
        glColor3f(0.88, 0.86, 0.92)
        glPushMatrix()
        glTranslatef(0.0, 0.85, 0.0)
        _draw_box(0.7, 1.2, 0.55)
        glPopMatrix()
        # Head
        glColor3f(0.98, 0.86, 0.76)
        glPushMatrix()
        glTranslatef(0.0, 1.72, 0.0)
        gluSphere(quad, 0.34, 12, 10)
        glPopMatrix()
        # Nón lá (cone)
        glColor3f(0.92, 0.76, 0.42)
        glPushMatrix()
        glTranslatef(0.0, 1.92, 0.0)
        glRotatef(-90.0, 1.0, 0.0, 0.0)
        gluCylinder(quad, 0.85, 0.02, 0.52, 18, 2)
        glPopMatrix()
        # Small hanging lantern scaling with carried motes
        glow = 0.18 + 0.18 * (sim.player.carried / max(1, sim.tuning.carry_capacity))
        glColor3f(1.0, 0.78, 0.25)
        glPushMatrix()
        glTranslatef(0.0, 1.55, 0.65)
        gluSphere(quad, glow, 10, 8)
        glPopMatrix()
        glPopMatrix()

        # Pulse expanding ring VFX
        if pulse_ring_t > 0.0:
            glDisable(GL_LIGHTING)
            prog = 1.0 - (pulse_ring_t / 0.55)
            glColor3f(1.0, 0.82, 0.3)
            _draw_circle_xz(px, 0.08, pz, sim.tuning.pulse_radius * prog, segments=40, filled=False)
            glEnable(GL_LIGHTING)

        hud_surf = _render_hud_surface(sim, screen_mode, font_lg, font_sm)
        _draw_hud_overlay(hud_surf)

        pygame.display.flip()
        clock.tick(60)

    pygame.quit()
    sys.exit(0)


if __name__ == "__main__":
    run_app()
