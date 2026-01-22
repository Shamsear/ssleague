import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;

        if (!token) {
            return NextResponse.json(
                { user: null, error: 'Not authenticated' },
                { status: 401 }
            );
        }

        // Verify JWT token
        const secret = new TextEncoder().encode(
            process.env.JWT_SECRET || 'your-secret-key-here'
        );

        const { payload } = await jwtVerify(token, secret);

        // Return user data from token
        return NextResponse.json({
            user: {
                id: payload.userId,
                email: payload.email,
                name: payload.name || payload.email,
                role: payload.role,
            },
        });
    } catch (error) {
        console.error('Error verifying auth token:', error);
        return NextResponse.json(
            { user: null, error: 'Invalid token' },
            { status: 401 }
        );
    }
}
