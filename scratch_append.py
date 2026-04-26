with open("prisma/schema.prisma", "a") as f:
    f.write("""

model ChatMessage {
  id        String   @id @default(cuid())
  projectId String
  userId    String
  role      String   // "user" | "assistant"
  content   String   @db.Text
  createdAt DateTime @default(now())

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([projectId, userId])
}
""")
