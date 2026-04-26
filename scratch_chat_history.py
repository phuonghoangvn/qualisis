import sys

file_path = "/Users/Maria/Documents/QualiSIS/src/app/api/projects/[projectId]/chat/route.ts"
with open(file_path, "r") as f:
    content = f.read()

# Append GET and DELETE methods
methods = """
export async function GET(
    req: Request,
    { params }: { params: { projectId: string } }
) {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const messages = await prisma.chatMessage.findMany({
            where: { projectId: params.projectId, userId: session.user.id },
            orderBy: { createdAt: 'asc' }
        })
        
        return NextResponse.json(messages.map(m => ({ role: m.role, content: m.content })))
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: { projectId: string } }
) {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        await prisma.chatMessage.deleteMany({
            where: { projectId: params.projectId, userId: session.user.id }
        })
        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
"""

if "export async function GET" not in content:
    content += methods

# Now update the POST method to save to DB
save_user_msg = """
        const latestUserMessage = messages[messages.length - 1]
        
        // Save user message to DB
        await prisma.chatMessage.create({
            data: {
                projectId,
                userId: session.user.id,
                role: 'user',
                content: latestUserMessage.content
            }
        })
"""
# Insert save_user_msg before Call GPT-4o
content = content.replace("// ── Call GPT-4o", save_user_msg + "\n        // ── Call GPT-4o")

save_ai_msg = """
        const responseText = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.'

        // Save AI response to DB
        await prisma.chatMessage.create({
            data: {
                projectId,
                userId: session.user.id,
                role: 'assistant',
                content: responseText
            }
        })
"""
content = content.replace("const responseText = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.'", save_ai_msg)

with open(file_path, "w") as f:
    f.write(content)
print("Updated successfully")
