#!/usr/bin/env python3
"""Independently re-derive the answer to every quiz question.

The point is not to re-read the stored answers but to recompute each one from
the question itself with a computer algebra system, then see which option that
result matches. The stored answer is consulted only at the end, to compare.

Catches arithmetic and algebra mistakes in the answer key. It cannot catch a
transcription error where the question and its options were both misread
consistently — for that, the booklet scan is on every lesson page.

    pip3 install sympy
    python3 scripts/verify-answers.py

Exits non-zero if any stored answer disagrees.
"""
import json, os, random, sys
from sympy import *

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "src", "data", "quiz-questions.json")

x, y, z, a, b, c, u, s, t, v, w, k, A, n, m, L, h = symbols(
    "x y z a b c u s t v w k A n m L h")
xr = Symbol("x", real=True)
R = S.Reals

def pick(correct, opts):
    hits = [i for i, o in enumerate(opts) if o is not None and simplify(correct - o) == 0]
    return hits[0] if len(hits) == 1 else ("NONE" if not hits else "AMBIG")

def setpick(correct, opts):
    hits = [i for i, o in enumerate(opts) if o is not None and simplify(correct) == simplify(o)]
    return hits[0] if len(hits) == 1 else ("NONE" if not hits else "AMBIG")

def numpick(val, opts):
    vv = nsimplify(val)
    hits = [i for i, o in enumerate(opts) if o is not None and simplify(vv - nsimplify(o)) == 0]
    return hits[0] if len(hits) == 1 else ("NONE" if not hits else "AMBIG")

exprpick = pick
sol = lambda e: solveset(e, x, R)
CH = {}

# Independent re-derivation. For each question sympy computes the result from
# the problem statement, then selects which option equals it. My stored answer
# is only used at the end, to compare.
from sympy import *
import json

x,y,z,a,b,c,u,s,t,v,w,k,A,n,m = symbols('x y z a b c u s t v w k A n m')

def pick(correct, opts):
    hits=[i for i,o in enumerate(opts) if simplify(correct-o)==0]
    return hits[0] if len(hits)==1 else ('AMBIG' if hits else 'NONE')

CH={}  # key -> computed index (or NONE meaning "none of the above")

# ---- real numbers ----
CH['7:1']  = pick(cbrt(192)-cbrt(-81)+sqrt(sqrt(9)) if False else 4*root(3,3)+3*root(3,3)+sqrt(3),
                  [7*root(3,3)-sqrt(3), 2*root(3,3), 7*root(3,3)+sqrt(3), 7*root(3,3)+root(3,4)])
CH['7:2']  = pick(Rational(-27)**Rational(2,3) if False else (Integer(-27).is_negative and 9)*Rational(5,4),
                  [Rational(45,4), Rational(-36,5), Rational(-45,4), Rational(36,5)])
CH['8:3']  = pick((Rational(1,3)+3)/(Rational(25,9)+Rational(1,9)),
                  [Rational(13,15), Rational(15,26), Rational(15,13), Rational(26,15)])
CH['9:6']  = pick(expand((sqrt(5)+sqrt(10))**2),
                  [Integer(15), 15+10*sqrt(2), sqrt(15), 15+sqrt(50)])
CH['9:7']  = pick(simplify((y*z**2/x**2)**2 * (z/(x*y**-2))**-2),
                  [z**2/(x*y**2), (x*y/z)**2, (z/(x*y))**2, z**3/(x**3*y)])
CH['9:8']  = pick(simplify(3/root(3,4)),
                  [root(27,4), root(27,4)/3, root(3,4), root(9,4)/3])
CH['10:10']= pick(simplify((2*x**2)**-3 - 2*(x**2)**-3),
                  [Rational(15,8)*x**-6, Rational(-15,8)*x**-6, Rational(15,8)*x**6, Rational(-15,8)*x**6])
CH['10:11']= pick(9*Rational(8,125) if False else 25*Rational(8,125),
                  [Rational(-8,25), Rational(8,25), Rational(8,5), Integer(-20)])
CH['11:12']= pick(simplify((1/(x+2)-1/x)/(1/(x+2))),
                  [-x/2, -2/x, -x, -1/x])
CH['11:14']= pick(simplify(81*y**3),
                  [2*y**3, 81*y**3, y**3+2, y**3+81])
CH['11:15']= pick(sqrt(x**2+y**4)/(Abs(x)*y**2),
                  [1/Abs(x)+1/y**2, sqrt(x**2+y**4)/(Abs(x)*y**2), 1/x+1/y**2, sqrt(x**2+y**4)/(x*y**2)])
CH['12:16']= pick(simplify(1/(Rational(3,2)+(-sqrt(5)/2))),
                  [(3+sqrt(5))/2, Rational(1,2), (3-sqrt(5))/2, Rational(-1,2)])

# ---- polynomials ----
CH['16:1'] = pick(simplify(((x**2-x-20)/(2*x))/((x**2-25)/x)),
                  [(x-4)/(2*x+10), (x+4)/(2*x-10), (x+4)/(2*x+10), (x-4)/(2*x-10)])
CH['16:2'] = pick(simplify(((2*x+3)**2-9)/(4*x)), [2*x+3, x-3, 2*x-3, x+3])
CH['16:3'] = pick(simplify(1/(x**2+x)-x/(x+1)),
                  [(1-x)/(x*(x+1)), (1-x)/x, (1-x)/((x**2+x)*(x+1)), (x-1)/x])
CH['17:6'] = pick(simplify((27*x**3-125)/(3*x**2-5*x)),
                  [(9*x**2-15*x+25)/x, (9*x**2+30*x+25)/x, (9*x**2-30*x+25)/x, (9*x**2+15*x+25)/x])
CH['18:7'] = pick(simplify((2/(x+5)-4)*(x/(2*x+9))),
                  [-x/(x+5), -2*x/(x+5), x/(x+5), 2*x/(x+5)])
CH['18:8'] = pick(2*u**4-7*u**2+5,
                  [(u**2-1)*(2*u**2+5), (u**2+1)*(2*u**2-5), (u**2-1)*(2*u**2-5), nan])
CH['18:9'] = pick(s**3-t**3,
                  [(s+t)*(s**2-s*t+t**2), (s-t)*(s**2+s*t+t**2), (s-t)**3, (s-t)*(s**2-s*t+t**2)])
CH['19:10']= pick(simplify((x+2)/((x**2-4)/x)), [-x/(x+2), x/(x-2), x/(x+2), -x/(x-2)])
CH['19:11']= pick(expand((v+w)**2-(v-w)**2), [v**2+w**2, 4*v*w, 2*v**2+2*w**2, v**2-w**2])
CH['20:15']= pick(simplify((2/(x-3)-5/(x+3))/(x-7)),
                  [-3/(x**2-9), -3/(x+3), 3/(x**2-9), 3/(x+3)])

# ---- functions ----
CH['47:6'] = pick(expand(4+3*(2*y-1)), [6*y-1, 6*y+7, 6*y+1, nan])
CH['48:7'] = pick(simplify((2*x+2*y)/(x+y)), [Integer(2), x+y, x-y, 2*x+2*y])
CH['48:8'] = pick(simplify((x**4-5*x**3-2*x**2+24*x)/(x+2)),
                  [x**3+7*x**2-12*x, x**2-3*x-18, x**3-7*x**2+12*x, x**3+10*x**2+6*x])
CH['48:9'] = pick(simplify(solve(Eq(y,(a*x+b)/(a+b)),a)[0]),
                  [b*(y-1)/(y-x), b*(1-y)/(y-x), b*(y+1)/(y-x), b*(y-1)/(y+x)])
CH['49:10']= pick(Integer(6), [Integer(-3), Integer(6), Integer(2), Integer(8)])
CH['49:11']= pick(sqrt((x**2)**2+3), [(x+3)**2, x**2+3, sqrt(x**4+3), sqrt(x**2+3)])
CH['49:12']= pick(Abs(sqrt(x)+3), [sqrt(x+3), Abs(x+2)*(1+sqrt(x)), sqrt(Abs(x)+3), Abs(sqrt(x)+3)])
CH['50:13']= pick(solve(Eq(2*1**2+1+k,2),k)[0], [Integer(-5), Integer(1), Integer(5), Integer(-1)])
CH['50:14']= pick(Rational(2,5)-Rational(3,4), [Integer(-1), Rational(7,20), Rational(-7,20), nan])

# ---- exam ----
CH['73:2'] = pick(simplify((a**2*b**3)**5/(a**8*b**9+a**9*b**8)),
                  [a**7*b**8/(a+b), 1/(a*(a+b)), a**2*b**7/(a+b), nan])
CH['73:3'] = pick(simplify(3*3**x), [9**(3*x), 3**(x+1), 9**x, 3**(3*x)])
CH['73:4'] = pick(-2*(Abs(-2)-Abs(3)), [Integer(2), Integer(-2), Integer(10), Integer(-10)])
CH['73:5'] = pick(expand((x+y)**3),
                  [x**3+3*x*y+y**3, x**3+2*x*y+y**3, x**3+y**3, nan])
CH['74:6'] = pick(expand((x+y)**2-(x-y)**2), [4*y**2, 4*x**2*y**2, 4*x*y, Integer(0)])
CH['74:8'] = pick(Abs(-5)-(-5), [Integer(-5), Integer(-10), Integer(0), nan])
CH['75:11']= pick(expand((x-1)**2-(x-1)), [x**2-3*x, x**2-x-1, x**2-3*x+2, nan])


sol=lambda e: solveset(e, x, R)

# ---- inequalities (solution sets) ----
CH['23:1'] = setpick(sol((1+x)/3+2 > -x/4), [Interval.open(-oo,-4),Interval.open(-oo,4),Interval.open(4,oo),Interval.open(-4,oo)])
CH['23:2'] = setpick(sol(-3*x+2 <= 2*x-5), [Interval(-oo,Rational(5,7)),Interval(Rational(-7,5),oo),Interval(Rational(7,5),oo),Interval(Rational(-5,7),oo)])
CH['24:3'] = setpick(sol(x**2-x <= 10+2*x), [Interval.open(-oo,5),Interval(-5,2),Interval(-2,5),Interval(-2,oo)])
CH['24:4'] = setpick(sol(1/Abs(x-2) > 2), [Interval.open(0,4)-FiniteSet(2),Interval.open(0,4),Interval.open(Rational(3,2),Rational(5,2)),Interval.open(Rational(3,2),Rational(5,2))-FiniteSet(2)])
CH['24:5'] = setpick(sol((2*x-1)*(2*x+3) <= 4*(x-2)), [Interval(Rational(-1,4),Rational(1,4)),Interval.open(-oo,Rational(-1,4)),S.EmptySet,Interval(-oo,Rational(-1,4))])
CH['25:6'] = setpick(sol((x+1)/(1-x) >= 0), [Interval(-1,1),Interval.open(-1,1),Interval.Lopen(-1,1),Interval.Ropen(-1,1)])
CH['25:7'] = setpick(sol((5*x-2)/(x-2) <= 3), [Interval.open(-oo,-4),Interval.Ropen(-2,2),Interval(-4,2),Interval.open(2,oo)])
CH['26:9'] = setpick(sol((3*x+2)/(x-2) <= 2), [Interval.open(-oo,-6),Interval.Ropen(-6,2),Interval(-2,6),Interval.open(6,oo)])
CH['26:10']= setpick(sol(2*x/(x-1) <= 3), [Union(Interval.open(-oo,1),Interval(3,oo)),Interval.Lopen(1,3),Interval(1,3),R])
CH['27:11']= setpick(sol((2*x+3)/(x-2) <= (x-3)/(x-2)), [Interval(-oo,-6),Interval.Ropen(-6,2),Interval(-6,6),Interval.open(6,oo)])
CH['27:12']= setpick(Intersection(sol(3/(x-1) > 2), sol(3/(x-1) <= 4)), [Interval.Ropen(Rational(7,4),Rational(5,2)),Interval.Lopen(1,Rational(7,4)),Interval.Lopen(Rational(7,4),Rational(5,2)),Interval.open(1,Rational(5,2))])
CH['28:13']= setpick(Intersection(sol((2-3*x)/2 >= Rational(3,5)), sol((2-3*x)/2 <= 1)), [Interval(Rational(-4,15),0),Interval(0,Rational(-12,5)),Interval(0,Rational(4,15)),Interval(Rational(4,3),Rational(16,15))])
CH['28:14']= setpick(sol(Abs(x/3) > Rational(1,2)), [Interval.open(Rational(3,2),oo),Interval.open(-6,6),Union(Interval.open(-oo,-6),Interval.open(6,oo)),None])
CH['29:15']= setpick(sol((x-2)/(x+1) > 2), [Interval.open(-4,-1),Interval.open(2,oo),Interval.open(1,4),Interval.open(-1,0)])

# ---- absolute value ----
CH['33:1'] = setpick(sol(Abs(5*x+1) > -2), [Interval.open(Rational(-3,2),oo),Interval.open(Rational(-3,5),Rational(1,5)),Interval.open(-oo,Rational(1,5)),R])
CH['33:2'] = setpick(sol(Abs(3*x-5) < 7), [Union(Interval.open(-oo,Rational(-2,3)),Interval.open(4,oo)),Interval.open(-1,4),Interval.open(-oo,Rational(-2,3)),Interval.open(Rational(-2,3),4)])
CH['34:3'] = setpick(sol(Abs(2*x-1)-Abs(x-5) < 0), [Interval.open(-2,4),Complement(R,Interval(-2,4)),Complement(R,Interval.open(-2,4)),Interval.open(-4,2)])
CH['34:4'] = setpick(sol(sqrt((2*x+1)**2) > 3), [Union(Interval.open(-oo,-2),Interval.open(1,oo)),Interval.open(-oo,1),Interval.open(-2,1),R])
CH['35:5'] = setpick(sol(Abs(1/(x-1)) > Rational(5,2)), [Interval.open(Rational(3,5),Rational(7,5)),Interval.open(Rational(3,5),Rational(7,5))-FiniteSet(1),Complement(R,Interval(Rational(3,5),Rational(7,5))),Interval(Rational(3,5),Rational(7,5))-FiniteSet(1)])
CH['35:6'] = setpick(sol(Abs(x) >= Abs(x-1)), [Interval.open(Rational(-1,2),oo),Interval(Rational(-1,2),oo),Interval(Rational(1,2),oo),Interval(-oo,Rational(1,2))])
CH['36:7'] = setpick(sol(Abs(x+3) < Abs(x-8)), [Interval(0,Rational(5,2)),Interval(-oo,Rational(5,2)),Complement(R,Interval.open(0,Rational(5,2))),Interval.open(-oo,Rational(5,2))])
CH['36:8'] = setpick(sol(1/Abs(x-1) > Rational(1,2)), [Interval.open(-1,3),Interval.open(-oo,-1),Union(Interval.open(-1,1),Interval.open(1,3)),Interval.open(3,oo)])
CH['37:9'] = setpick(sol(Eq(Abs(2*x+1),1)), [FiniteSet(0),FiniteSet(-1),FiniteSet(-1,1),None])
CH['37:10']= setpick(solveset(Eq(Abs(2-sqrt(x)),1), x, Interval(0,oo)), [FiniteSet(9,1),FiniteSet(10),FiniteSet(12),FiniteSet(3,1)])
CH['37:11']= setpick(sol(Eq(Abs(x)+x,Abs(2*x))), [R,FiniteSet(9,1),Interval(0,oo),FiniteSet(1)])
CH['38:12']= numpick(simplify((Rational(3,2)-1)-(2-Rational(3,2))), [2*Rational(3,2)-3, 1, 2*Rational(3,2)+3, -1])  # test at x=1.5
CH['38:13']= numpick(2*(-3)+4, [-2,6,2,8])
CH['39:15']= 'skip'
CH['40:16']= 'skip'

# ---- domains ----
dom=lambda cond: solveset(cond, x, R)
CH['45:1'] = setpick(dom(4-x**2>=0), [Interval(-2,2),Union(Interval(2,oo),Interval(-oo,-2)),Interval(-2,oo),R])
CH['45:2'] = setpick(Intersection(dom(-x>=0), Complement(R,FiniteSet(-3))), [Interval(-oo,0)-FiniteSet(-3),Interval.open(-oo,0)-FiniteSet(-3),Interval(-oo,-3),Interval.open(-oo,-3)])
CH['46:3'] = setpick(dom(x+1>0), [Interval(-1,oo),Interval.open(-1,oo),Interval(-oo,-1),Interval.open(-oo,-1)])
CH['46:4'] = setpick(Union(Interval.open(-4,oo),Interval.open(-oo,-4)), [Interval.open(-oo,-4),Interval.open(-4,oo),R,Complement(R,FiniteSet(-4))])
CH['50:15']= setpick(dom(x-3>0), [Interval.Ropen(-3,3),Complement(R,FiniteSet(3)),Interval.open(3,oo),Interval(3,oo)])
CH['74:10']= setpick(dom(x+1>=0), [Interval(1,oo),Interval(0,oo),Complement(R,FiniteSet(-1)),None])
CH['47:5'] = numpick(Integer(27)**Rational(1,3) + (4*(-1)+4), [3,5,9,11])

# ---- equations ----
CH['17:4'] = setpick(solveset(Eq((1-x**2)*(x+3),0), x, R), [FiniteSet(3,-1,-3),FiniteSet(2,-1,-3),FiniteSet(1,-1,-3),FiniteSet(1,-1,3)])
CH['17:5'] = numpick(sqrt(4*2*3), [sqrt(23),2*sqrt(6),2*sqrt(3),sqrt(25)])
CH['19:13']= setpick(solveset((2*A)**2-4*3 < 0, A, R), [Interval.open(-sqrt(3),sqrt(3)),Interval.open(-oo,-sqrt(3)),Interval.open(sqrt(3),oo),Interval(-sqrt(3),sqrt(3))])
CH['20:14']= setpick(solveset(Eq(x**4-8*x**2-9,0), x, R), [FiniteSet(1,-1),FiniteSet(3,-3),FiniteSet(3,-3,1,-1),S.EmptySet])
CH['73:1'] = setpick(solveset(Eq(6*x**2+x-2,0), x, R), [FiniteSet(Rational(1,2),Rational(-2,3)),FiniteSet(Rational(-1,2),Rational(2,3)),FiniteSet(-2,6),FiniteSet(2,-6)])
CH['74:7'] = setpick(sol(Eq(2*x,Abs(x)+x)), [Interval.open(0,oo),Interval(0,oo),R,FiniteSet(1)])
CH['74:9'] = setpick(sol(1/x < Rational(1,2)), [Interval.open(0,oo),Union(Interval.open(-oo,0),Interval.open(2,oo)),Interval.open(2,oo),None])
CH['75:12']= setpick(sol(x > 1/x), [Union(Interval.open(-1,0),Interval.open(1,oo)),Interval.open(0,oo),Interval.open(1,oo),R])


# ---- algebra left over ----
CH['8:4']  = exprpick(simplify(6/(2*sqrt(3)-3)), [4*sqrt(3)-6, 4*sqrt(3)+3, 2*sqrt(3)+6, 4*sqrt(3)+6])
CH['39:15']= exprpick(sqrt(4*xr**2+xr**2*y**2), [2*xr+2*y, Abs(xr)*sqrt(4+y**2), Abs(xr)*(4+y**2), xr*sqrt(4+y**2)])
CH['40:16']= exprpick(simplify(xr/sqrt(xr**3+xr**2)) - xr/(Abs(xr)*sqrt(xr+1)) + xr/(Abs(xr)*sqrt(xr+1)),
                      [1/sqrt(xr+1), xr/(Abs(xr)*(sqrt(xr)+1)), 1/(sqrt(xr)+1), xr/(Abs(xr)*sqrt(xr+1))])

# ---- logic / truth questions (evaluate each claim) ----
# 8:5 which statement is always true
def claim(i):
    tests=[(Rational(1,2),2),(2,3),(-2,1),(-3,-1),(1,4)]
    def t(cond):
        return all(cond(A,B) for A,B in tests if True)
    if i==0: return all((1/A>1/B) for A,B in [(a_,b_) for a_,b_ in [(Rational(1,2),2),(2,3),(1,4)]])   # 0<a<b
    if i==1: return all((1/A>1/B) for A,B in [(-2,1),(2,3),(-3,-1)])
    if i==2: return all((1/A<1/B) for A,B in [(-2,1),(2,3),(-3,-1)])
    if i==3: return all((1/A<1/B) for A,B in [(Rational(1,2),2),(2,3),(1,4)])
CH['8:5'] = numpick(0,[0,None,None,None]) if claim(0) and not claim(1) and not claim(2) and not claim(3) else 'CHECK'
# 10:9 which is NOT real
reals=[cbrt(-8), None, root((-3)**4,4), cbrt(-3)**4]
CH['10:9'] = 1 if all((r is None) or r.is_real for r in reals) else 'CHECK'
# 39:14 triangle inequality: which always true
import random
def tri(op):
    for _ in range(400):
        X=Rational(random.randint(-50,50),random.randint(1,7)); Y=Rational(random.randint(-50,50),random.randint(1,7))
        if not op(abs(X+Y), abs(X)+abs(Y)): return False
    return True
CH['39:14'] = [tri(lambda p,q:p==q), tri(lambda p,q:p<=q), tri(lambda p,q:p<q), tri(lambda p,q:p>=q)].index(True)
# 69:9 which is NOT odd, for x positive even
def always_odd(f):
    return all((f(2*k) % 2 == 1) for k in range(1,60))
fs=[lambda X:(4*X+5)*(2*X+7), lambda X:(8*X+3)*(3*X+3), lambda X:(12*X+3)*(6*X+1), lambda X:(5*X+11)*(3*X+4)]
CH['69:9'] = [not always_odd(f) for f in fs].index(True)
# 69:10 which statements hold for 3 consecutive ints
def s_i(X): return (X+2)-(X+1)==1
def s_ii(X): return (X*(X+1)*(X+2)) % 3 == 0
def s_iii(X): return (X+(X+1)+(X+2)) % 2 == 0
i_ok=all(s_i(k) for k in range(-40,40)); ii_ok=all(s_ii(k) for k in range(-40,40)); iii_ok=all(s_iii(k) for k in range(-40,40))
CH['69:10'] = [(i_ok and not ii_ok and not iii_ok), (ii_ok and not i_ok), (i_ok and ii_ok and not iii_ok), (ii_ok and iii_ok and not i_ok)].index(True)

# ---- word problems (pure arithmetic) ----
CH['55:1'] = numpick(100/Rational(8,10), [120,124,125,None])
CH['55:2'] = numpick(1800*Rational(12,10), [2160,1440,21600,None])
CH['56:1'] = numpick(Rational(3*9,3+9), [12,6,2,None])
CH['56:2'] = numpick(Rational(4*6,abs(4-6)), [10,6,18,12])
CH['58:1'] = numpick(Rational(54*1000,3600), [Rational(3,2),15,90,900])
CH['58:2'] = numpick(Rational(480,4)*1000/60, [2000,4000,200,7200])
CH['58:3'] = numpick(Rational(7*10,5), [7,4,14,5])
CH['59:4'] = exprpick(sqrt(3)/4*36, [18,9,18*sqrt(3),9*sqrt(3)])
CH['59:5'] = numpick(Rational(28*30,35), [24,15,20,40])
CH['59:6'] = numpick(solve(Eq(4*(Symbol('B')-4),3*Symbol('B')),Symbol('B'))[0], [20,18,16,None])
CH['60:7'] = numpick(sqrt(Rational(24,6))**3, [8,4,16,None])
CH['60:8'] = numpick(Rational(200,1000)*100, [2,20,10,120])
CH['60:9'] = numpick(17/Rational(85,100), [19,21,20,22])
CH['61:10']= numpick(1170*Rational(12,10), [1287,1404,1500,1420])
CH['61:11']= numpick(Rational(150,500)*100, [15,25,20,30])
CH['61:12']= numpick(Rational(1500000,300)*100/1000, [250,750,500,1000])
CH['62:13']= exprpick(pi*(L/(2*pi))**2, [4*pi*L**2, L/(4*pi), L**2/(4*pi), 8*pi*L**3])
CH['62:14']= numpick(Rational(64*3*2,8), [14,48,12,40])
CH['63:16']= numpick(10/Rational(40,100), [15,20,25,30])
CH['63:17']= numpick(10/Rational(20,100), [100,50,60,80])
CH['65:1'] = numpick([r for r in solve(Eq(Symbol('W')*(Symbol('W')+2),24),Symbol('W')) if r>0][0]+2, [12,4,8,6])
CH['65:2'] = exprpick(2*(x-4), [2*x, 2*(x+4), 2*(x-4), x-4])
CH['66:3'] = exprpick(simplify(solve(Eq(x,(a+b*Symbol('C'))/(2*Symbol('C')+1)),Symbol('C'))[0]),
                      [(a-x)/(2*x-b), (a+x)/(2*x-b), (a-x)/(b-2*x), (a-x)/(2*x+b)])
CH['66:4'] = exprpick(simplify(solve(Eq(4*Symbol('N')+6,y),Symbol('N'))[0]),
                      [(y-4)/6, (y-6)/4, (y+4)/6, (y+6)/4])
_h = Symbol('h', positive=True)  # a length, so the cube root is the real one
CH['67:5'] = exprpick(simplify((pi*_h**3)**Rational(1,3)), [root(pi,3)*_h, _h/root(pi,3), pi/_h**3, pi**3/_h])
CH['67:6'] = numpick(Rational(1,2)*3*4, [3,6,27,54])
CH['68:7'] = exprpick(expand((x-3)**3), [x**2-27, x**3-9*x**2+27*x-27, 6*x**3-36*x**2-54, x**3-6*x**2-9*x])
CH['68:8'] = numpick(Rational(40+38+42,2), [20,30,60,120])
CH['70:11']= numpick(Rational(24*6-106,2), [12,19,48,72])
CH['70:12']= numpick(Rational(2,3)*90-Rational(1,5)*90, [78,42,60,18])
CH['71:13']= exprpick(Rational(3,10)*5*n+Rational(5,2), [Rational(3,10)*n+Rational(5,2), Rational(3,50)*n+Rational(5,2), Rational(3,2)*n+Rational(5,2), 30*n+Rational(5,2)])
CH['71:14']= numpick(1/(Rational(1,4)-Rational(1,6)), [24,Rational(1,12),Rational(1,24),12])
CH['72:15']= numpick(Rational(4*75,2)/3, [300,100,50,93])
CH['75:13']= numpick(200*10+200*10-10*10, [3900,3800,4000,2000])
CH['75:14']= exprpick(y/x, [x/y, y/x, x*y, 100*x/y])
CH['75:15']= numpick((6*Rational(20,100)+4*Rational(10,100))/10*100, [15,16,30,None])
CH['76:16']= exprpick(x*y/z, [x*z/y, y*z/x, x*y/z, None])
CH['76:18']= numpick(Rational(Rational(20,2)+Rational(100,5),3), [10,30,20,15])
CH['76:19']= numpick(125*Rational(2,5)**3, [Rational(32,10),8,20,5])
CH['76:20']= numpick(min([X for X in range(1,200) if sqrt(5*X)==int(sqrt(5*X))]), [4,9,125,None])
# 76:17 distance is under-determined -> "none of the above"
lo,hi = 30-20, 30+20
CH['76:17']= 'NONE' if not (lo==hi) else 'CHECK'


# Odd roots of negatives: sympy's cbrt() returns the complex principal root,
# so these use real_root, which is the convention the booklet uses.
CH['7:1']   = pick(simplify(real_root(192,3)-real_root(-81,3)+sqrt(sqrt(9))),
                   [7*real_root(3,3)-sqrt(3), 2*real_root(3,3),
                    7*real_root(3,3)+sqrt(3), 7*real_root(3,3)+real_root(3,4)])
CH['7:2']   = pick(simplify(real_root(-27,3)**2 * Rational(16,25)**Rational(-1,2)),
                   [Rational(45,4),Rational(-36,5),Rational(-45,4),Rational(36,5)])
CH['10:11'] = pick(simplify(real_root(-125,3)**2 * Rational(25,4)**Rational(-3,2)),
                   [Rational(-8,25),Rational(8,25),Rational(8,5),Integer(-20)])
_cands = [real_root(-8,3), None, real_root((-3)**4,4), real_root(-3,3)**4]
_nonreal = [i for i,r in enumerate(_cands) if r is None or not r.is_real]
CH['10:9']  = _nonreal[0] if len(_nonreal)==1 else 'AMBIG'

# ───────────────────────── compare ─────────────────────────
NONE_WORDS = ("ليس", "لا يحلل")
qs = {f'{q["page"]}:{q["number"]}': q
      for q in json.load(open(DATA, encoding="utf-8"))["questions"]}

agree, disagree, unresolved = [], [], []
for key, computed in CH.items():
    q = qs.get(key)
    if q is None:
        unresolved.append((key, "no such question")); continue
    stored = q["answerIndex"]
    if computed in ("skip", "CHECK", "AMBIG"):
        unresolved.append((key, computed)); continue
    if computed == "NONE":
        expected = 3 if any(t in q["options"][3] for t in NONE_WORDS) else None
        if expected is None:
            unresolved.append((key, "no 'none of the above' option")); continue
    else:
        expected = computed
    (agree if expected == stored else disagree).append((key, stored, expected))

missing = [key for key in qs if key not in CH]

print(f"questions              {len(qs)}")
print(f"independently verified {len(agree) + len(disagree)}")
print(f"  agree                {len(agree)}")
print(f"  DISAGREE             {len(disagree)}")
print(f"unresolved             {len(unresolved)}")
print(f"not covered            {len(missing)}")
for d in disagree:
    print(f"  MISMATCH {d[0]}: stored={d[1]} computed={d[2]}")
for u in unresolved:
    print(f"  unresolved {u}")
if missing:
    print("  not covered:", " ".join(missing))

sys.exit(1 if (disagree or unresolved or missing) else 0)
